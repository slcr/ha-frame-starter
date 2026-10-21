// Health window (optional/health): tap a person in frame_people. Weight, steps, resting heart rate, heart rate and
// HRV with the last 30 days, the activity rings, and last night with its sleep stages, in the person's colour.
// On purpose only as a window: the wall is seen by visitors too. It closes after 60 s by itself.
// The values come from Apple Health through the iPhone app Health Auto Export (packages/frame_health.yaml);
// the weight from any scale integration. Loaded by frame.js when `health:` is set in the household settings.
const H = () => document.querySelector('home-assistant').hass;

// chart: the kind of chart (see below); span: the smallest range of the value axis, so few or equal values don't
// stick to the edge; tip: the unit in the tooltips when it reads differently
const METRICS = [
  { k: 'weight', unit: 'kg', dec: 1, chart: 'line', span: 2 },
  { k: 'steps', unit: '', tip: 'steps', chart: 'bars', span: 4000 },
  { k: 'sleep', unit: 'h', chart: 'line', span: 2, hm: true },
  { k: 'rhr', unit: 'bpm', chart: 'dots', span: 10 },
  { k: 'hr', unit: 'bpm', chart: 'range', span: 30 },
  { k: 'hrv', unit: 'ms', chart: 'range', span: 20 },
];
// Activity rings as on the watch: move (kcal), exercise (min), stand (h) against their goal
const RINGS = [['move', 'kcal', '#E5174F'], ['exercise', 'min', '#4CB32B'], ['stand', 'h', '#16AFCF']];
const STAGES = ['Awake', 'REM', 'Core', 'Deep'];

export const open = (el, vars) => {
  const root = el.getRootNode();
  if (root.querySelector('.ced--person')) return;
  const h = H(), fx = window.frame.fx.call(null, h.states, h, vars), t = fx.t, esc = fx.esc;
  const p = fx.people.find((x) => x.id === el.dataset.who);
  const cfg = p && (vars.health || {})[p.id];
  if (!cfg) return;
  const val = (id) => {
    const s = id && h.states[id];
    return s && s.state !== '' && !isNaN(Number(s.state)) ? Number(s.state) : null;
  };
  const nf = (v, d) => fx.nf(v, d || 0);
  const hm = (v) => { const m = Math.round(v * 60); return `${Math.floor(m / 60)}:${fx.pad(m % 60)}`; };
  // Health Auto Export writes "2026-10-12 22:31:28 +0200"; Safari only reads ISO
  const iso = (s) => (s ? new Date(String(s).replace(' ', 'T').replace(/ ?([+-]\d\d):?(\d\d)$/, '$1:$2')) : null);

  // ---------- activity rings; over 100 % the ring stays full, the number shows the real value
  const hasAct = RINGS.some(([k]) => cfg[k] && val(cfg[k]) != null);
  const actHtml = (() => {
    if (!hasAct) return '';
    const rows = RINGS.filter(([k]) => cfg[k]).map(([k, unit, col]) => ({ k, unit, col, v: val(cfg[k]), goal: Number(cfg[k + '_goal']) || null }));
    const rings = rows.map((r, i) => {
      const rad = 50 - i * 15, c = 2 * Math.PI * rad, f = r.v != null && r.goal ? Math.min(1, r.v / r.goal) : 0;
      return `<circle class="ar-track" cx="60" cy="60" r="${rad}" stroke="${r.col}"/>
        <circle class="ar-fill" cx="60" cy="60" r="${rad}" stroke="${r.col}" stroke-dasharray="${(f * c).toFixed(1)} ${c.toFixed(1)}"/>`;
    }).join('');
    const legend = rows.map((r) => `<div class="ar-row"><span class="label" style="color:${r.col}">${esc(t(`hl_${r.k}`))}</span>
      <b>${r.v == null ? '–' : nf(r.v)}<small>${r.goal ? ` / ${nf(r.goal)}` : ''} ${esc(r.unit)}</small></b></div>`).join('');
    // steps as a fourth value, with the bars of the last 30 days below (the same chart as in the tiles)
    const n = cfg.steps ? val(cfg.steps) : null;
    const steps = cfg.steps ? `<div class="ar-row ar-steps" data-id="${esc(cfg.steps)}" data-chart="bars" data-unit="${esc(t('hl_steps_unit'))}" data-dec="0"
      data-lo="" data-hi="" data-span="4000" data-now="${n != null ? n : ''}">
      <span class="label">${esc(t('hl_steps'))}<i class="pp-range"></i></span><b>${n == null ? '–' : nf(n)}</b><div class="pp-spark"></div></div>` : '';
    return `<section class="act"><svg class="ar" viewBox="0 0 120 120" aria-hidden="true"><g transform="rotate(-90 60 60)">${rings}</g></svg>
      <div class="ar-legend"><span class="label">${esc(t('hl_activity'))}</span>${legend}${steps}</div></section>`;
  })();

  // ---------- tiles: sleep only when there's no "Last night" block, steps only without activity rings
  const tiles = METRICS.filter((m) => cfg[m.k] && (m.k !== 'sleep' || val(cfg.sleep) == null) && (m.k !== 'steps' || !hasAct)).map((m) => {
    const v = val(cfg[m.k]), goal = m.k === 'weight' ? val(cfg.goal) : null;
    const sub = v != null && goal != null ? `${t('hl_goal', nf(goal, 1))} · ${v - goal > 0.05 ? t('hl_to_go', nf(v - goal, 1)) : t('hl_reached')}` : '';
    return `<div class="pp-m" data-id="${esc(cfg[m.k])}" data-chart="${m.chart}" data-unit="${esc(m.tip ? t('hl_steps_unit') : m.unit)}" data-dec="${m.dec || 0}"
      data-lo="${esc(cfg[m.k + '_min'] || '')}" data-hi="${esc(cfg[m.k + '_max'] || '')}" data-span="${m.span}" data-now="${v != null ? v : ''}">
      <span class="label">${esc(t(`hl_${m.k}`))}<i class="pp-range"></i></span>
      <b>${v == null ? '–' : m.hm ? hm(v) : nf(v, m.dec)}${v != null && m.unit ? `<small>${esc(m.unit)}</small>` : ''}</b>
      ${sub ? `<span class="pp-sub">${esc(sub)}</span>` : ''}<div class="pp-spark"></div></div>`;
  }).join('');
  const nTiles = (tiles.match(/class="pp-m"/g) || []).length || 1;

  // ---------- last night as in the Health app: the stages over the night (when single stages arrive) and the time
  // per stage. Without single stages: the times from the summary, awake = time in bed minus sleep.
  const sleepHtml = (() => {
    const s = cfg.sleep && h.states[cfg.sleep];
    const total = val(cfg.sleep);
    if (!s || total == null) return '';
    const a = s.attributes;
    let phases = (Array.isArray(a.phases) ? a.phases : [])
      .map((x) => ({ from: iso(x[0]), to: iso(x[1]), st: x[2] === 'Asleep' ? 'Core' : x[2] }))
      .filter((x) => x.from && x.to && x.to > x.from);
    // stages only when they belong to the same night as the totals
    const woke = iso(a.woke);
    if (phases.length && woke && Math.abs(phases[phases.length - 1].to - woke) > 3 * 36e5) phases = [];
    const t0 = phases.length ? phases[0].from : iso(a.asleep);
    const t1 = phases.length ? phases[phases.length - 1].to : woke;
    const hrs = {};
    if (phases.length) phases.forEach((x) => { hrs[x.st] = (hrs[x.st] || 0) + (x.to - x.from) / 36e5; });
    else {
      Object.assign(hrs, { REM: Number(a.rem) || 0, Core: Number(a.core) || 0, Deep: Number(a.deep) || 0 });
      if (a.awake != null) hrs.Awake = Number(a.awake) || 0;
      else if (t0 && t1) hrs.Awake = Math.max(0, (t1 - t0) / 36e5 - total);
    }
    const name = (k) => t(`hl_st_${k}`);
    let graph = '';
    if (phases.length && t1 > t0) {
      const X = (x) => ((x - t0) / (t1 - t0) * 1000).toFixed(1);
      const Y = { Awake: 4, REM: 40, Core: 76, Deep: 112 };
      // vertical links between the stages, the bars on top
      const links = phases.slice(1).map((x, i) => `<line x1="${X(x.from)}" x2="${X(x.from)}" y1="${Y[phases[i].st] + 12}" y2="${Y[x.st] + 12}"/>`).join('');
      const bars = phases.map((x) => `<rect class="st-${x.st}" x="${X(x.from)}" y="${Y[x.st]}" width="${Math.max(2, X(x.to) - X(x.from)).toFixed(1)}" height="24" rx="6"/>`).join('');
      // full hours as the axis (every other one in a long night)
      const ticks = [];
      const step = (t1 - t0) > 9 * 36e5 ? 2 : 1;
      const d = new Date(t0);
      d.setMinutes(0, 0, 0);
      for (d.setHours(d.getHours() + 1); d < t1; d.setHours(d.getHours() + 1)) {
        if (d.getHours() % step === 0) ticks.push(`<span style="left:${X(d) / 10}%">${esc(fx.hourLabel(d).replace(/:00$/, ''))}</span>`);
      }
      // tooltips: the stage at every spot (one point per 1 %, plus the middle of each stage so short wakes can be hit)
      const tipOf = (x) => ({ x: Number((X(x.from) / 20 + X(x.to) / 20).toFixed(2)), y: (Y[x.st] + 12) / 140 * 100,
        h: `<b>${esc(name(x.st))}</b> ${fx.time(x.from)}–${fx.time(x.to)}<small>${(x.to - x.from) < 36e5 ? `${Math.round((x.to - x.from) / 6e4)} ${esc(t('min'))}` : `${hm((x.to - x.from) / 36e5)} h`}</small>` });
      const tips = phases.map(tipOf);
      for (let i = 0; i <= 100; i++) {
        const at = new Date(t0.getTime() + (t1 - t0) * i / 100);
        const ph = phases.find((x) => x.from <= at && at < x.to);
        if (ph) tips.push(Object.assign(tipOf(ph), { x: i }));
      }
      graph = `<div class="sl-graph"><div class="sl-plot ch-plot"${fx.tipPlot(tips)}><svg viewBox="0 0 1000 140" preserveAspectRatio="none" aria-hidden="true">
        <g class="sl-links">${links}</g>${bars}</svg>${fx.TIP}</div><div class="sl-ticks">${ticks.join('')}</div></div>`;
    } else if (total > 0) {
      const sum = STAGES.reduce((n, k) => n + (hrs[k] || 0), 0) || 1;
      graph = `<div class="sl-bar">${STAGES.filter((k) => hrs[k] > 0).map((k) => `<i class="st-${k}" style="flex:${hrs[k] / sum}"></i>`).join('')}</div>`;
    }
    const legend = STAGES.filter((k) => hrs[k] != null).map((k) => `<div class="sl-st"><i class="st-${k}"></i>${esc(name(k))}<b>${hm(hrs[k])}</b></div>`).join('');
    const span = t0 && t1 ? `${fx.time(t0)} – ${fx.time(t1)}` : '';
    return `<section class="sl">
      <div class="sl-top"><div><span class="label">${esc(t('hl_last_night'))}</span><b class="sl-dur">${hm(total)}<small>${esc(t('hl_hours_sleep'))}</small></b>
        ${span ? `<span class="pp-sub">${span}</span>` : ''}</div><div class="sl-legend">${legend}</div></div>
      ${graph}
      ${phases.length ? '' : `<span class="pp-note">${esc(t('hl_no_stages'))}</span>`}
      <div class="sl-trend" data-id="${esc(cfg.sleep)}"><span class="label">${esc(t('hl_30_nights'))}<i class="pp-range"></i></span><div class="sl-nights"></div></div>
    </section>`;
  })();
  const s = cfg.sync && h.states[cfg.sync];
  const sync = !cfg.sync ? '' : s && !['unknown', 'unavailable'].includes(s.state) ? t('hl_synced', fx.when(new Date(s.state))) : t('hl_never_synced');
  const note = [cfg.weight ? t(cfg.sync ? 'hl_from_scale_health' : 'hl_from_scale') : '', sync].filter(Boolean).join(' ');

  // ---------- window
  const w = document.createElement('div');
  w.className = 'ced-wrap';
  w.innerHTML = `<div class="ced ced--person" style="${fx.pstyle(p)}">
    <div class="ced-head"><b>${esc(p.name)}</b><button class="ced-x" data-a="close" aria-label="${esc(t('close'))}"><ha-icon icon="mdi:close"></ha-icon></button></div>
    <div class="ced-body">${actHtml}${tiles ? `<div class="pp-tiles" style="--n:${Math.min(4, nTiles)};--n2:${Math.min(2, nTiles)}">${tiles}</div>` : ''}${sleepHtml}
      ${note ? `<span class="pp-note">${esc(note)}</span>` : ''}</div></div>`;
  root.appendChild(w);
  const close = () => { clearTimeout(timer); w.remove(); };
  const timer = setTimeout(close, 60000);
  w.addEventListener('pointerup', (e) => { if (e.target === w || e.target.closest('[data-a="close"]')) close(); });

  // ---------- a chart per tile over 30 days, as in the Health app: bars = a bar per day (steps, the counter's increase),
  // dots = a point per day (resting heart rate), range = the day's span with its average (HRV, heart rate),
  // line = a curve. The sensors hold today's value; what counts is the last hourly value of each day (the day's
  // average would still include the day before until the first sync in the morning). Without _min/_max sensors:
  // the sensor's own min/max. line falls back to 48 hours or the last value for new sensors.
  const list = [...w.querySelectorAll('[data-chart]')];
  const stats = (ids, period, from, types) => h.callWS({ type: 'recorder/statistics_during_period',
    start_time: from.toISOString(), statistic_ids: ids, period, types }).catch(() => ({}));
  const allIds = [...new Set(list.flatMap((x) => [x.dataset.id, x.dataset.lo, x.dataset.hi]).filter(Boolean))];
  const days = Array.from({ length: 30 }, (_, i) => fx.day0(new Date(), i - 29));
  const today = days[29].getTime();
  const dayName = (d) => (d.getTime() === today ? t('today') : `${fx.weekday(d, 'short')} ${fx.dateShort(d)}`);
  const byDay = (res, id, key) => {
    const o = {};
    (res[id] || []).forEach((r) => { if (r[key] != null) o[fx.day0(new Date(r.start)).getTime()] = r[key]; });
    return o;
  };
  // value range with a smallest span and a little room above and below; y in % from the top
  const scaler = (vals, span) => {
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max(0, (span - (hi - lo)) / 2);
    lo -= pad; hi += pad;
    return (v) => 92 - (v - lo) / (hi - lo || 1) * 84;
  };
  const xOf = (i) => (i + 0.5) / 30 * 100;
  const plot = (inner, tips) => `<div class="pp-chart ch-plot"${fx.tipPlot(tips)}>${inner}${fx.TIP}</div>`;
  if (allIds.length) Promise.all([
    stats(allIds, 'day', days[0], ['mean', 'min', 'max', 'change']),
    stats(allIds, 'hour', new Date(Date.now() - 48 * 36e5), ['mean', 'state']),
    stats(allIds, 'hour', days[0], ['mean']),
  ]).then(([day, hour, hours30]) => list.forEach((x) => {
    const id = x.dataset.id, kind = x.dataset.chart, unit = x.dataset.unit, span = Number(x.dataset.span);
    const now = x.dataset.now === '' ? null : Number(x.dataset.now);
    const dec = Number(x.dataset.dec || 0);
    let html = '', range = t('hl_30_days');
    if (kind === 'bars') {
      const v = byDay(day, id, 'change');
      if (now != null) v[today] = now;
      const max = Math.max(1, ...Object.values(v));
      const tips = [];
      const bars = days.map((d, i) => {
        const n = v[d.getTime()];
        if (n == null) return '<i class="is-gap"></i>';
        tips.push({ x: xOf(i), i, h: `${esc(dayName(d))} · <b>${nf(n)}</b>${unit ? ' ' + esc(unit) : ''}` });
        return `<i class="${d.getTime() === today ? 'is-now' : ''}" style="height:${Math.max(3, n / max * 100).toFixed(1)}%"></i>`;
      }).join('');
      if (tips.length) html = plot(`<div class="bars">${bars}</div>`, tips);
    } else if (kind === 'dots') {
      const v = byDay(hours30, id, 'mean');
      if (now != null) v[today] = now;
      const pts = days.map((d, i) => ({ d, i, v: v[d.getTime()] })).filter((q) => q.v != null);
      if (pts.length) {
        const y = scaler(pts.map((q) => q.v), span);
        const line = pts.length > 1 ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.map((q) => `${xOf(q.i).toFixed(2)},${y(q.v).toFixed(2)}`).join(' ')}"/></svg>` : '';
        const dots = pts.map((q) => `<b class="pp-dot" style="left:${xOf(q.i)}%;top:${y(q.v).toFixed(1)}%"></b>`).join('');
        html = plot(line + dots, pts.map((q) => ({ x: xOf(q.i), y: y(q.v), h: `${esc(dayName(q.d))} · <b>${nf(q.v, dec)} ${esc(unit)}</b>` })));
      }
    } else if (kind === 'range') {
      const mean = byDay(hours30, id, 'mean');
      const lo = x.dataset.lo ? byDay(hours30, x.dataset.lo, 'mean') : byDay(day, id, 'min');
      const hi = x.dataset.hi ? byDay(hours30, x.dataset.hi, 'mean') : byDay(day, id, 'max');
      // today: the current values
      if (now != null) mean[today] = now;
      if (x.dataset.lo && val(x.dataset.lo) != null) lo[today] = val(x.dataset.lo);
      if (x.dataset.hi && val(x.dataset.hi) != null) hi[today] = val(x.dataset.hi);
      const pts = days.map((d, i) => {
        const k = d.getTime(), m = mean[k];
        if (m == null) return null;
        return { d, i, m, lo: Math.min(m, lo[k] != null ? lo[k] : m), hi: Math.max(m, hi[k] != null ? hi[k] : m) };
      }).filter(Boolean);
      if (pts.length) {
        const y = scaler(pts.flatMap((q) => [q.lo, q.hi]), span);
        const caps = pts.map((q) => `<i class="pp-cap" style="left:${xOf(q.i)}%;top:${y(q.hi).toFixed(1)}%;height:${Math.max(0, y(q.lo) - y(q.hi)).toFixed(1)}%"></i>
          <b class="pp-dot" style="left:${xOf(q.i)}%;top:${y(q.m).toFixed(1)}%"></b>`).join('');
        html = plot(caps, pts.map((q) => ({ x: xOf(q.i), y: y(q.m),
          h: `${esc(dayName(q.d))} · <b>Ø ${nf(q.m, dec)} ${esc(unit)}</b>${q.hi > q.lo ? `<small>${nf(q.lo, dec)}–${nf(q.hi, dec)} ${esc(unit)}</small>` : ''}` })));
      }
    } else {
      const pick = (res, key) => (res[id] || []).map((r) => ({ start: r.start, mean: r[key] })).filter((r) => r.mean != null);
      let rows = pick(day, 'mean'), hours = 30 * 24;
      if (rows.length < 3) {
        rows = pick(hour, 'mean'); hours = 48; range = t('hl_48_hours');
        const st = h.states[id];
        if (!rows.length && st && now != null) { rows = [{ start: st.last_changed, mean: now }]; range = t('hl_since', fx.time(new Date(st.last_changed))); }
      }
      html = fx.spark(rows, hours, { now, minSpan: span });
    }
    x.querySelector('.pp-spark').innerHTML = html;
    x.querySelector('.pp-range').textContent = html ? range : '';
  }));
  // 30 nights as bars: a night's value = the sleep time at the end of the day it ended on (the day's last hourly
  // value, today the current one). Missing nights stay a gap.
  const trend = w.querySelector('.sl-trend');
  if (trend) stats([trend.dataset.id], 'hour', fx.day0(new Date(), -29), ['mean']).then((res) => {
    const per = {};
    (res[trend.dataset.id] || []).forEach((r) => { if (r.mean != null) per[fx.day0(new Date(r.start)).getTime()] = r.mean; });
    const cur = val(trend.dataset.id);
    if (cur != null) per[today] = cur;
    const got = days.map((d) => per[d.getTime()]).filter((v) => v != null);
    if (!got.length) { trend.remove(); return; }
    const lo = 4, hi = Math.max(10, ...got);
    const bars = days.map((d) => {
      const v = per[d.getTime()];
      return v == null ? '<i class="is-gap"></i>'
        : `<i class="${d.getTime() === today ? 'is-last' : ''}" style="height:${Math.max(6, (v - lo) / (hi - lo) * 100).toFixed(0)}%"></i>`;
    }).join('');
    const tips = days.map((d, i) => ({ d, i, v: per[d.getTime()] })).filter((q) => q.v != null).map((q) => ({
      x: (q.i + 0.5) / 30 * 100, i: q.i, h: `${esc(q.d.getTime() === today ? t('hl_last_night') : dayName(q.d))} · <b>${hm(q.v)} h</b>` }));
    trend.querySelector('.sl-nights').outerHTML = `<div class="sl-nights bars ch-plot"${fx.tipPlot(tips)}>${bars}${fx.TIP}</div>`;
    trend.querySelector('.pp-range').textContent = `Ø ${hm(got.reduce((a, b) => a + b, 0) / got.length)} h`;
  });
};
