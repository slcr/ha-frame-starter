// Weather window: tap frame_weather. The whole day at a glance instead of reaching for a weather app:
// the parts of the day, the next 24 hours (swipe sideways), the next days and today's numbers, over a sky
// that matches the weather. Loaded by frame.js on first use; data from weather.get_forecasts (hourly, daily).
//
// Sky pictures: www/frame/wx/sky/<name>.webp, named after Home Assistant's weather conditions. At night,
// clear, partly cloudy, cloudy and rainy have their own pictures; the others use the darkened day picture.
// Try one in the browser console: window.__frameWxSky = 'rainy' (null = follow the weather again).
const V = new URL(import.meta.url).search;
const DIR = new URL('.', import.meta.url).pathname;
const SKY = {
  sunny: 'sunny', 'clear-night': 'clear-night', partlycloudy: 'partlycloudy', cloudy: 'cloudy', fog: 'fog', rainy: 'rainy', pouring: 'pouring',
  lightning: 'lightning', 'lightning-rainy': 'lightning', exceptional: 'lightning', snowy: 'snowy', 'snowy-rainy': 'snowy-rainy', hail: 'snowy-rainy',
  windy: 'windy', 'windy-variant': 'windy',
};
const SKY_NIGHT = { sunny: 'clear-night', partlycloudy: 'partlycloudy-night', cloudy: 'cloudy-night', rainy: 'rainy-night' };
const sky = (cond, night) => {
  const force = window.__frameWxSky, n = force || (night && SKY_NIGHT[cond]) || SKY[cond];
  if (!n) return null;
  const dark = /night$|^lightning$/.test(n), dim = !force && night && !dark;
  return { src: `${DIR}wx/sky/${n}.webp${V}`, dark: dark || dim, dim };
};

const H = () => document.querySelector('home-assistant').hass;
const icon = (i) => `<ha-icon icon="${i}"></ha-icon>`;

// Frame: tinted head (label, big value, close), the content below. render() returns {icon, label, big, sub, sky, top, body};
// the window only redraws when that changes. Closes after 2 min without a touch (wall tablet), on a tap outside or on X.
const sheet = (root, render, closeLabel) => {
  const w = document.createElement('div');
  w.className = 'ced-wrap dv-wrap';
  w.innerHTML = '<div class="ced dv dv--wx"></div>';
  const box = w.firstChild;
  let last = '', idle;
  const close = () => { clearInterval(tick); clearTimeout(idle); w.remove(); };
  const poke = () => { clearTimeout(idle); idle = setTimeout(close, 120000); };
  const draw = () => {
    if (!w.isConnected) { close(); return; }
    const r = render();
    const head = `<div class="dv-top">
        <span class="dv-ico">${icon(r.icon)}</span>
        <div class="dv-title"><span class="label">${r.label}</span><b>${r.big}</b>${r.sub ? `<span class="dv-sub">${r.sub}</span>` : ''}</div>
        <button class="ced-x" data-a="close" aria-label="${closeLabel}">${icon('mdi:close')}</button>
      </div>${r.top || ''}`;
    const html = `${r.sky ? `<div class="dv-sky${r.sky.dark ? ' is-dark' : ''}${r.sky.dim ? ' is-dim' : ''}"><img class="dv-sky-img" src="${r.sky.src}" alt="">${head}</div>`
      : head}<div class="dv-body">${r.body}</div>`;
    if (html !== last) { box.innerHTML = html; last = html; }
  };
  w.addEventListener('pointerdown', poke);
  w.addEventListener('pointerup', (e) => { if (e.target === w || e.target.closest('[data-a="close"]')) close(); });
  root.appendChild(w);
  draw();
  poke();
  // the forecast may still be on its way; afterwards this only catches the hour changing
  const tick = setInterval(draw, 5000);
  return { draw, close };
};

export const open = (el, id, vars) => {
  const root = el.getRootNode();
  if (root.querySelector('.dv--wx')) return;
  const fx0 = window.frame.fx.call(null, H().states, H(), vars);
  sheet(root, () => {
    const h = H(), fx = window.frame.fx.call(null, h.states, h, vars), t = fx.t, esc = fx.esc;
    const cur = h.states[id], a = cur ? cur.attributes : {}, now = new Date(), u = fx.wxUnits(id);
    const night = !!h.states['sun.sun'] && h.states['sun.sun'].state === 'below_horizon';
    const deg = (v) => (v == null || isNaN(v) ? '–' : `${Math.round(v)}°`);
    const hours = fx.wxHours(id).filter((x) => x.t.getTime() > now - 3600000);
    const daily = fx.forecast(id, 'daily');
    // entity down: the condition of the kept forecast (fx.forecast)
    const cond = fx.ok(id) ? cur.state : hours[0] && hours[0].cond;
    const temp = a.temperature != null ? a.temperature : hours[0] && hours[0].temp;
    const today = hours.filter((x) => fx.dayDiff(x.t, now) === 0);
    const hi = daily.length ? daily[0].temperature : today.length ? Math.max(...today.map((x) => x.temp)) : null;
    const lo = daily.length && daily[0].templow != null ? daily[0].templow : today.length ? Math.min(...today.map((x) => x.temp)) : null;
    const feel = a.apparent_temperature != null ? a.apparent_temperature : hours[0] && hours[0].feel;
    const sub = [hi != null && `${t('high')} ${deg(hi)}`, lo != null && `${t('low')} ${deg(lo)}`, feel != null && `${t('feels')} ${deg(feel)}`].filter(Boolean).join(' · ');
    const head = { icon: fx.wxIcon(cond, night), label: `${esc(t('weather'))} · ${esc(fx.weekday(now))}, ${esc(fx.dateLong(now))}`,
      big: `${deg(temp)}<small>${esc(cond ? fx.wxName(id, cond) : '')}</small>`, sub, sky: sky(cond, night) };
    if (!hours.length) return Object.assign(head, { body: `<p class="dv-hint">${esc(t('forecast_na'))}</p>` });
    const amount = (mm) => `${fx.nf(mm, u.precip === 'in' ? 2 : 1)} ${esc(u.precip)}`;
    const gustTxt = (g) => `${Math.round(g)} ${esc(u.wind)}`;
    const gustsFrom = vars.gusts_from || 50;

    // Parts of the day from the current one: night 0–6, morning 6–12, afternoon 12–18, evening 18–24
    const parts = [];
    for (let k = Math.floor(now.getHours() / 6), n = 0; n < 4; k++, n++) {
      const from = fx.day0(now); from.setHours(k * 6);
      const to = new Date(+from + 6 * 3600000);
      const xs = hours.filter((x) => x.t >= from && x.t < to);
      if (!xs.length) break;
      const tomorrow = from >= fx.day0(now, 1);
      const name = t(n === 0 ? `wx_now_${k % 4}` : k % 4 === 0 ? (tomorrow && k > 4 ? 'wx_tom_0' : 'wx_part_0') : `${tomorrow ? 'wx_tom_' : 'wx_part_'}${k % 4}`);
      const wetH = xs.filter(fx.wet), worst = xs.reduce((p, q) => (fx.wxRank(q.cond) > fx.wxRank(p.cond) ? q : p));
      const isNight = (x) => x.t.getHours() >= 21 || x.t.getHours() < 6;
      const ts = xs.map((x) => x.temp), t1 = Math.round(Math.min(...ts)), t2 = Math.round(Math.max(...ts));
      const mm = xs.reduce((s, x) => s + x.mm, 0), pop = Math.max(0, ...wetH.map((x) => x.pop));
      const gust = xs.reduce((p, q) => (q.gustKmh > p.gustKmh ? q : p));
      const rain = wetH.length ? [pop ? `${pop} %` : '', mm >= 0.1 ? amount(mm) : ''].filter(Boolean).join(' · ') || t('some_rain') : t('dry');
      parts.push(`<div class="wxs-part${wetH.length ? ' is-wet' : ''}"><span class="label">${esc(name)}</span>
        ${icon(fx.wxIcon(worst.cond, isNight(xs[Math.floor(xs.length / 2)])))}
        <b class="num">${t1 === t2 ? `${t1}°` : `${t1}–${t2}°`}</b>
        <small>${esc(fx.wxName(id, worst.cond))}</small><em>${esc(rain)}</em>
        ${gust.gustKmh >= gustsFrom ? `<em class="is-warn">${esc(t('gusts_to', gustTxt(gust.gust)))}</em>` : ''}</div>`);
    }

    // The next 24 hours, swipe sideways; temperature curve and rain bars behind, as on the card
    const day = hours.slice(0, 24), CW = 56, GH = 36;
    const tsd = day.map((x) => x.temp), tmin = Math.min(...tsd), tmax = Math.max(...tsd);
    const span = Math.max(8, tmax - tmin), tlo = (tmax + tmin) / 2 - span / 2;
    const ty = (v) => 4 + (1 - (v - tlo) / span) * (GH - 10), cx = (k) => (k + 0.5) * CW, f1 = (v) => v.toFixed(1);
    const P = day.map((x, k) => [cx(k), ty(x.temp)]);
    let d = `M0,${f1(P[0][1])} L${f1(P[0][0])},${f1(P[0][1])}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
    }
    const W = day.length * CW;
    d += ` L${W},${f1(P[P.length - 1][1])}`;
    const bars = day.map((x, k) => (fx.wet(x) && x.pop
      ? `<rect${x.pop >= 50 ? ' class="is-wet"' : ''} x="${cx(k) - 7}" y="${f1(GH * (1 - x.pop / 100))}" width="14" height="${f1(GH * x.pop / 100)}" rx="2"/>` : '')).join('');
    const hourTxt = (x) => (fx.h12 ? x.t.toLocaleTimeString(fx.lang, { hour: 'numeric', hour12: true }) : String(x.t.getHours()));
    const cols = day.map((x, k) => {
      const midnight = k > 0 && x.t.getHours() === 0;
      const isNight = x.t.getHours() >= 21 || x.t.getHours() < 6;
      return `<div class="wxs-h${fx.wet(x) ? ' is-wet' : ''}${midnight ? ' is-day0' : ''}"><span>${esc(k === 0 ? t('now') : midnight ? fx.weekday(x.t, 'short') : hourTxt(x))}</span>
        ${icon(fx.wxIcon(x.cond, isNight))}<b class="num">${Math.round(x.temp)}°</b>
        <small>${fx.wet(x) && x.pop ? `${x.pop} %` : '&nbsp;'}</small></div>`;
    }).join('');
    const hourly = `<div class="dv-sec"><span class="label">${esc(t('next_24h'))}</span>
      <div class="wxs-scroll"><div class="wxs-hours" style="width:${W}px">
        <svg class="wxs-graph" viewBox="0 0 ${W} ${GH}" width="${W}" height="${GH}" aria-hidden="true">
          <path class="wx-tarea" d="${d} L${W},${GH} L0,${GH} Z"/><g class="wx-rain">${bars}</g><path class="wx-tline" d="${d}"/></svg>
        ${cols}</div></div></div>`;

    // Today in numbers; facts without a value are left out
    const fact = (label, value, warn) => (value == null || value === '' ? ''
      : `<div class="dv-fact${warn ? ' is-warn' : ''}"><span>${esc(label)}</span><b>${value}</b></div>`);
    const sun = (h.states['sun.sun'] || {}).attributes || {};
    const at = (v) => (v ? esc(fx.time(new Date(v))) : null);
    const d0 = daily[0] || {};
    const todayH = today.length ? today : hours.slice(0, 1);
    const uv = d0.uv_index != null ? d0.uv_index : Math.max(...todayH.map((x) => x.uv || 0)) || null;
    const gmax = d0.wind_gust_speed != null ? d0.wind_gust_speed : todayH.some((x) => x.gustReal != null) ? Math.max(...todayH.map((x) => x.gustReal || 0)) : null;
    const rsum = d0.precipitation != null ? d0.precipitation : today.length ? today.reduce((s, x) => s + x.mm, 0) : null;
    const dirs = t('compass').split(',');
    const facts = `<div class="dv-facts">
        ${fact(t('sunrise'), at(sun.next_rising))}
        ${fact(t('sunset'), at(sun.next_setting))}
        ${fact(t('rain_today'), rsum == null ? null : rsum >= 0.1 ? amount(rsum) : esc(t('dry')))}
        ${fact(t('wind'), a.wind_speed != null ? `${Math.round(a.wind_speed)} ${esc(u.wind)}${a.wind_bearing != null ? ` ${esc(t('wind_from', dirs[Math.round(a.wind_bearing / 45) % 8]))}` : ''}` : null)}
        ${fact(t('gusts_today'), gmax == null ? null : esc(t('up_to', gustTxt(gmax))), gmax * u.k >= 60)}
        ${fact(t('uv'), uv == null ? null : `${Math.round(uv)} · ${esc(t(`uv_${uv < 3 ? 0 : uv < 6 ? 1 : uv < 8 ? 2 : 3}`))}`, uv >= 6)}
      </div>`;

    // Next days: low to high as a bar on one shared scale
    const days = daily.slice(0, 7).filter((x) => x.temperature != null);
    const lows = days.map((x) => (x.templow != null ? x.templow : x.temperature)), highs = days.map((x) => x.temperature);
    const smin = Math.min(...lows), ss = Math.max(1, Math.max(...highs) - smin);
    const rows = days.map((x, i) => {
      const dt = new Date(x.datetime), wetD = fx.wet({ cond: x.condition, pop: x.precipitation_probability || 0, mmMm: (x.precipitation || 0) * u.mm });
      const l = (lows[i] - smin) / ss * 100, w = Math.max(4, (highs[i] - lows[i]) / ss * 100);
      const n = fx.dayDiff(dt, now);
      return `<li class="${wetD ? 'is-wet' : ''}"><b>${esc(n === 0 ? t('today') : n === 1 ? t('tomorrow') : fx.weekday(dt))}</b>
        ${icon(fx.wxIcon(x.condition, false))}
        <em>${wetD && x.precipitation_probability ? `${x.precipitation_probability} %` : ''}</em>
        <span class="num">${deg(lows[i])}</span><i class="wxs-bar"><i style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}%"></i></i><span class="num">${deg(highs[i])}</span></li>`;
    }).join('');
    const week = rows ? `<div class="dv-sec"><span class="label">${esc(t('next_days'))}</span><ul class="wxs-days">${rows}</ul></div>` : '';

    return Object.assign(head, {
      // the 24 hours still belong to the head: the sky fades out behind them and ends under the curve
      top: `${parts.length ? `<div class="wxs-parts">${parts.join('')}</div>` : ''}<div class="wxs-hsky">${hourly}</div>`,
      body: `<div class="wxs-cols">${week}<div class="dv-sec"><span class="label">${esc(t('today'))}</span>${facts}</div></div>`,
    });
  }, fx0.esc(fx0.t('close')));
};
