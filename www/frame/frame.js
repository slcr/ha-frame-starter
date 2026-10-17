// Frame runtime. Load it once as a Lovelace resource:
//   url: /local/frame/frame.js?v=1   type: module
//
// - window.frame.fx(states, hass, variables) returns the helpers every Frame template uses
//   (formatting, people, calendar, forecast, history, sparklines, light colours ...). The templates
//   call it from one variable, so the code is parsed once per page instead of on every render:
//     fx: "[[[ return window.frame && window.frame.fx.call(this, states, hass, variables); ]]]"
// - frame.css is fetched once and shared by every card that inherits from the `frame` template
//   (adoptedStyleSheets), instead of a copy of the stylesheet in each card.
// - button-card: if HACS already registered it as a resource, it is used as-is. If it is not on the
//   page after a few seconds, frame.js loads it from /hacsfiles/button-card/button-card.js.
//
// After editing frame.js or frame.css, bump ?v= in the resource URL so browsers fetch the new files.
const V = new URL(import.meta.url).search;
const DIR = new URL('.', import.meta.url).pathname;
const BUTTON_CARD = '/hacsfiles/button-card/button-card.js';

const canAdopt = 'adoptedStyleSheets' in Document.prototype && 'replaceSync' in CSSStyleSheet.prototype;
const sheet = canAdopt ? new CSSStyleSheet() : null;
let cssText = '';

// Light tiles blend between colour mixes. Gradients cannot be animated, registered custom properties can,
// so every colour stop is its own property (6 colour spots + base + wash). @property is global only.
if (window.CSS && CSS.registerProperty) {
  const reg = (name, syntax, initialValue) => { try { CSS.registerProperty({ name, syntax, inherits: true, initialValue }); } catch (e) { /* already registered */ } };
  for (let i = 0; i < 6; i++) {
    reg(`--lg-c${i}`, '<color>', 'transparent');
    reg(`--lg-t${i}`, '<color>', 'transparent');
    ['x', 'y', 'w'].forEach((k) => reg(`--lg-${k}${i}`, '<percentage>', '50%'));
  }
  reg('--lg-base', '<color>', 'transparent');
  reg('--lg-wash', '<color>', 'transparent');
}
// A re-rendered light tile starts with the old colours, then gets the new ones so the browser can blend
window.__frameGlowFlush = (root) => root && root.querySelectorAll('[data-glow]').forEach((el) => {
  getComputedStyle(el).getPropertyValue('--lg-base');
  el.dataset.glow.split(';').forEach((d) => { const i = d.indexOf(':'); el.style.setProperty(d.slice(0, i), d.slice(i + 1)); });
  el.removeAttribute('data-glow');
});

// UI strings. Override any of them in the `frame` template: variables.text: { today: Heute, ... }
const TEXT = {
  today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', now: 'Now', all_day: 'All day', until: 'until {0}',
  home: 'Home', away: 'Away', unknown: 'Unknown', unavailable: 'Unavailable', never: 'Never',
  up_next: 'Up next', happening: 'Happening now', min_left: 'min left', min: 'min', until_time: 'until', at: '',
  nothing_planned: 'Nothing planned.', enjoy: 'Enjoy the quiet.', next_7_days: 'Next 7 days',
  no_events: 'No events', no_events_sub: 'in the next 7 days', today_all_day: 'Today',
  weather_na: 'Weather not available', forecast_na: 'No hourly forecast', high: 'High', low: 'Low', feels: 'Feels like',
  rain_from: 'Rain from {0}.', rain_now: 'Rain until {0}.', windy: 'Windy.',
  wear_coat: 'Coat.', wear_jacket: 'Jacket.', wear_sweater: 'Sweater.', wear_tshirt: 'T-shirt.', wear_umbrella: 'Umbrella.',
  on: 'On', off: 'Off', open: 'Open', closed: 'Closed', opening: 'opening', closing: 'closing',
  n_of_m_on: '{0} of {1} on', all_off: 'All off', lights_on: '{0} on', all_open: 'All open', all_closed: 'All closed',
  n_of_m_open: '{0} of {1} open', n_of_m_closed: '{0} of {1} closed',
  windows_doors: 'Windows & doors', all_closed_big: 'All closed', n_open: '{0} open', open_since: 'Open since',
  opened_today: 'Opened today', last_opened: 'Last opened',
  door: 'Front door', door_open: 'Door open', battery: 'Battery',
  low_24h: 'Low', high_24h: 'High', trend_3h: '3 h', target: 'Target', stale: 'No new values',
};

window.frame = {
  fx(states, hass, variables) {
    const card = this;
    const T = Object.assign({}, TEXT, variables.text || {});
    const t = (key, ...a) => String(T[key] == null ? key : T[key]).replace(/\{(\d)\}/g, (_, i) => (a[i] == null ? '' : a[i]));
    const loc = (hass && hass.locale) || {};
    const lang = loc.language || navigator.language || 'en';
    const h12 = loc.time_format === '12' ? true : loc.time_format === '24' ? false
      : new Intl.DateTimeFormat(lang, { hour: 'numeric' }).resolvedOptions().hour12;

    const pad = (n) => String(n).padStart(2, '0');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const nf = (v, d) => Number(v).toLocaleString(lang, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });

    // ------------------------------------------------------------ dates
    const time = (d) => d.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit', hour12: h12 });
    // Big clock: "5:40" + "PM" separately, so the period can be set small
    const clock = (d) => {
      const parts = new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit', hour12: h12 }).formatToParts(d);
      const ampm = parts.find((p) => p.type === 'dayPeriod');
      return { hm: parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim(), ampm: ampm ? ampm.value : '' };
    };
    const hourLabel = (d) => (h12 ? d.toLocaleTimeString(lang, { hour: 'numeric', hour12: true }) : time(d));
    const weekday = (d, style) => d.toLocaleDateString(lang, { weekday: style || 'long' });
    const dateLong = (d) => d.toLocaleDateString(lang, { day: 'numeric', month: 'long' });
    const dateShort = (d) => d.toLocaleDateString(lang, { day: 'numeric', month: 'numeric' });
    const day0 = (d, plus) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      x.setDate(x.getDate() + (plus || 0));
      return x;
    };
    const dayDiff = (d, now) => Math.round((day0(d) - day0(now || new Date())) / 864e5);
    const dayLabel = (d, now) => {
      const n = dayDiff(d, now);
      return n === 0 ? t('today') : n === 1 ? t('tomorrow') : n === -1 ? t('yesterday') : weekday(d);
    };
    // "Today 7:02", "Yesterday 21:30", "Wed 10/9 18:00"
    const when = (d, now) => {
      const n = dayDiff(d, now);
      return `${n === 0 ? t('today') : n === -1 ? t('yesterday') : `${weekday(d, 'short')} ${dateShort(d)}`} ${time(d)}`;
    };
    const dur = (ms) => (ms < 3600000 ? `${Math.max(1, Math.round(ms / 60000))} ${t('min')}`
      : ms < 48 * 3600000 ? `${Math.floor(ms / 3600000)}:${pad(Math.floor(ms % 3600000 / 60000))} h`
      : `${Math.round(ms / 864e5)} d`);

    // ------------------------------------------------------------ states
    const ok = (id) => !!states[id] && !['unknown', 'unavailable'].includes(states[id].state);
    // State as HA shows it: translated, with unit
    const fmt = (id) => {
      const s = states[id];
      if (!s) return null;
      return hass && hass.formatEntityState ? hass.formatEntityState(s) : s.state;
    };
    // Number in the user's locale + unit, or null when the state is not numeric
    const num = (id, dec) => {
      const s = states[id];
      if (!s || s.state === '' || isNaN(Number(s.state))) return null;
      const v = Number(s.state);
      return { raw: v, v: nf(v, dec), unit: String(s.attributes.unit_of_measurement || '') };
    };
    const nameOf = (id) => (states[id] && states[id].attributes.friendly_name) || id;

    // ------------------------------------------------------------ people
    const rgb = (h) => {
      const n = parseInt(String(h).slice(1), 16);
      return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
    };
    const people = variables.people || [];
    const family = variables.family || { id: 'family', name: 'Everyone', color: '#D62F6E', ink: '#FFFFFF', icon: 'mdi:star' };
    const everyone = people.concat([family], variables.categories || []);
    const person = (id) => everyone.find((p) => p.id === id) || family;
    const pstyle = (p) => `--c:${p.color};--c-rgb:${rgb(p.color)};--c-ink:${p.ink || '#FFFFFF'};`;
    const avatar = (p, size, away) =>
      `<span class="av${p.icon ? ' av--icon' : ''}${away ? ' av--away' : ''}" style="${pstyle(p)}width:${size}px;height:${size}px;font-size:${Math.round(size * 0.5)}px">${
        p.icon ? `<ha-icon icon="${p.icon}" style="--mdc-icon-size:${Math.round(size * 0.62)}px"></ha-icon>` : esc(p.name.charAt(0))}</span>`;

    // ------------------------------------------------------------ data from Home Assistant
    // WebSocket/REST data with a page-wide cache (survives switching views). Returns what is cached and
    // reloads in the background when it is older than maxAgeMin; cards waiting for it redraw when it arrives.
    const cached = (storeName, key, maxAgeMin, load, map) => {
      const store = window[storeName] || (window[storeName] = {});
      const entry = store[key] || (store[key] = { at: 0, pending: false, data: null });
      if (Date.now() - entry.at > maxAgeMin * 60000 && hass) {
        const waiting = entry.waiting || (entry.waiting = new Set());
        if (card && card.requestUpdate) waiting.add(card);
        if (!entry.pending) {
          entry.pending = true;
          Promise.resolve().then(load).then((res) => { entry.data = map ? map(res) : res; entry.at = Date.now(); })
            .catch(() => { entry.at = Date.now() - Math.max(0, maxAgeMin - 1) * 60000; }) // failed: retry in a minute
            .finally(() => {
              entry.pending = false;
              waiting.forEach((c) => { if (c.isConnected) c.requestUpdate('_config'); });
              waiting.clear();
            });
        }
      }
      return entry.data;
    };
    const ws = (msg) => () => hass.callWS(msg);
    // Long-term statistics (period: 5minute | hour | day; types: mean, min, max, change)
    const hist = (ids, hours, maxAgeMin, period, types) => {
      const per = period || 'hour', typ = types || ['mean'];
      return cached('__frameHist', ids.slice().sort().join('|') + '@' + hours + '/' + per + '/' + typ.join(','), maxAgeMin || 10, ws({
        type: 'recorder/statistics_during_period',
        start_time: new Date(Date.now() - hours * 3600000).toISOString(),
        statistic_ids: ids, period: per, types: typ,
      })) || {};
    };
    // State changes from the history: {entity_id: [{s: state, t: ms}]}
    const changes = (ids, hours, maxAgeMin) => (ids.length ? cached('__frameStates', ids.slice().sort().join('|') + '@' + hours, maxAgeMin || 5, ws({
      type: 'history/history_during_period',
      start_time: new Date(Date.now() - hours * 3600000).toISOString(),
      entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
    }), (res) => {
      const out = {};
      Object.keys(res || {}).forEach((id) => { out[id] = res[id].map((x) => ({ s: x.s, t: (x.lc != null ? x.lc : x.lu) * 1000 })); });
      return out;
    }) : null) || {};
    // Runs of "not off" from state changes: [{from, to}] (to = null while running)
    const runs = (list, off) => {
      const out = [];
      let cur = null;
      (list || []).forEach((x) => {
        if (x.s === 'unavailable' || x.s === 'unknown') return;
        const on = !off.includes(x.s);
        if (on && !cur) cur = { from: x.t, to: null };
        else if (!on && cur) { cur.to = x.t; out.push(cur); cur = null; }
      });
      if (cur) out.push(cur);
      return out;
    };
    // Weather forecast via weather.get_forecasts (type: hourly | daily | twice_daily), cached 15 min.
    // Returns [] when the integration does not offer that type.
    const forecast = (id, type) => (id ? cached('__frameWx', id + '/' + type, 15, () => hass.callWS({
      type: 'call_service', domain: 'weather', service: 'get_forecasts',
      target: { entity_id: id }, service_data: { type }, return_response: true,
    }), (res) => (((res && res.response) || {})[id] || {}).forecast || []) : null) || [];
    // Calendar events between start and end for variables.calendars ([{entity, who, readonly?}]) or the given list, cached 5 min.
    // [{who, cal, uid, rid, rrule, title, loc, desc, status, all_day, from, to, readonly}] sorted by start.
    const parse = (s, allDay) => (allDay ? new Date(`${s}T00:00:00`) : new Date(s));
    const events = (start, end, list) => {
      const cals = list || variables.calendars || [];
      if (!cals.length) return [];
      const key = cals.map((c) => c.entity).join('|') + '@' + start.getTime() + '/' + end.getTime();
      return cached('__frameCal', key, 5, () => Promise.all(cals.map((c) => {
        const q = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
        return hass.callApi('GET', `calendars/${c.entity}${q}`).then((list) => list.filter((x) => x.status !== 'cancelled').map((x) => {
          const allDay = !!(x.start && x.start.date);
          return { who: c.who || family.id, cal: c.entity, uid: x.uid || null, rid: x.recurrence_id || null, rrule: x.rrule || null,
            title: x.summary || '', loc: x.location || '', desc: x.description || '', status: x.status || '', all_day: allDay, readonly: !!c.readonly,
            from: parse(allDay ? x.start.date : x.start.dateTime, allDay), to: parse(allDay ? x.end.date : x.end.dateTime, allDay) };
        })).catch(() => []);
      })), (lists) => [].concat(...lists).sort((a, b) => a.from - b.from)) || null;
    };
    // The next `days` days from today 0:00 (frame_next, frame_agenda)
    const agenda = (days) => { const a = day0(new Date()); return events(a, day0(a, days || 7)) || []; };
    // First day of the week: the profile setting, else the language's (0 = Sunday)
    const firstWeekday = () => {
      const W = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      if (W.includes(loc.first_weekday)) return W.indexOf(loc.first_weekday);
      try { const wi = new Intl.Locale(lang).weekInfo || new Intl.Locale(lang).getWeekInfo(); return wi.firstDay % 7; } catch (e) { return 1; }
    };

    // ------------------------------------------------------------ lights
    // Is it really on? Light groups report "on" even when their members are unreachable, so for groups
    // only reachable members count. id = one light/group or a list of lights. Returns {on, pct, dim} or null.
    const lit = (id) => {
      const many = Array.isArray(id), s = many ? null : states[id];
      if (!many && (!s || ['unavailable', 'unknown'].includes(s.state))) return null;
      const ids = many ? id : s.attributes.entity_id;
      const parts = Array.isArray(ids) ? ids.map((m) => states[m]).filter((m) => m && ['on', 'off'].includes(m.state)) : [s];
      if (!parts.length) return null;
      const on = parts.filter((m) => m.state === 'on');
      const br = on.map((m) => m.attributes.brightness).filter((b) => b != null);
      return { on: on.length > 0, pct: on.length ? (br.length ? Math.round(br.reduce((a, b) => a + b, 0) / br.length / 2.55) : 100) : 0, dim: br.length > 0 };
    };
    // Colour mix of a light tile from the lights that are on: large soft colour spots, alternating top and
    // bottom, half mixed with white so text stays readable. Lights without colour count as warm white.
    // Returns the --lg-* properties as "name:value;...". No light on: everything transparent.
    const GLOW_VARS = [...Array(6).keys()].flatMap((i) => ['c', 't', 'x', 'y', 'w'].map((k) => `--lg-${k}${i}`)).concat('--lg-base', '--lg-wash');
    const glow = (list) => {
      const cols = [];
      list.filter((s) => s && s.state === 'on').forEach((s) => {
        const c = s.attributes.rgb_color || [255, 211, 81];
        if (cols.length < 6 && !cols.some((q) => q.every((v, i) => Math.abs(v - c[i]) < 28))) cols.push(c);
      });
      const mix = (c, f, a) => `rgb(${c.map((v) => Math.round(v + (255 - v) * f)).join(' ')} / ${a})`;
      const v = {}, c0 = cols[0] || [255, 211, 81];
      const slot = (i, c, f, a, x, y, w) => Object.assign(v, {
        [`--lg-c${i}`]: mix(c, f, a), [`--lg-t${i}`]: mix(c, f, 0), [`--lg-x${i}`]: `${x}%`, [`--lg-y${i}`]: `${y}%`, [`--lg-w${i}`]: `${w}%` });
      for (let i = 0; i < 6; i++) slot(i, c0, 0.45, 0, 50, 50, 40);
      v['--lg-base'] = mix(c0, 0.5, cols.length ? 1 : 0);
      v['--lg-wash'] = `rgb(250 248 243 / ${cols.length ? 0.66 : 0})`;
      if (cols.length === 1) { slot(0, c0, 0.75, 1, 14, 0, 70); slot(1, c0, 0.3, 1, 88, 100, 70); }
      const n = cols.length, w = Math.round(140 / n + 30);
      if (n > 1) cols.forEach((c, i) => slot(i, c, 0.45, 1, Math.round((i + 0.5) / n * 100), i % 2 ? 100 : 0, w));
      return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';');
    };
    // For a re-rendered tile: start with the computed values of the old tile, target values go to data-glow
    const glowStyle = (list, old) => {
      const now = glow(list);
      if (!old || !old.isConnected) return { style: now, attr: '' };
      const cs = getComputedStyle(old);
      return { style: GLOW_VARS.map((k) => `${k}:${cs.getPropertyValue(k).trim()}`).join(';'), attr: ` data-glow="${now}"` };
    };
    // Lights of a Home Assistant area (entity area, else device area). Skips groups, hidden and config entities.
    const areaLights = (area) => {
      const reg = (hass && hass.entities) || {}, devs = (hass && hass.devices) || {};
      const raw = (card && card._hass && card._hass.states) || (hass && hass.states) || {};
      return Object.keys(raw).filter((id) => {
        const e = reg[id];
        return id.startsWith('light.') && !Array.isArray(raw[id].attributes.entity_id) && e && !e.hidden && !e.entity_category
          && (e.area_id || (devs[e.device_id] || {}).area_id) === area;
      }).sort();
    };
    // Cover position (100 = open). While moving, covers that do not report positions on the way can be
    // estimated from their travel time (variables.cover_travel: {cover.x: seconds}).
    const coverPos = (st) => {
      const raw = st.attributes.current_position != null ? Number(st.attributes.current_position) : st.state === 'closed' ? 0 : 100;
      const moving = ['opening', 'closing'].includes(st.state) ? st.state : null;
      const T0 = (variables.cover_travel || {})[st.entity_id];
      if (!moving || !T0) return { pos: raw, moving, est: false };
      const done = (Date.now() - new Date(st.last_changed).getTime()) / (T0 * 1000) * 100;
      return { pos: Math.round(Math.max(0, Math.min(100, moving === 'closing' ? raw - done : raw + done))), moving, est: true };
    };

    // ------------------------------------------------------------ charts and detail overlays
    // Tap details: element with class `tap` + tapAttr(key), more(...) as its last child. Tapping lays a dark
    // overlay with key/value rows over the element; tapping again or 12 s close it. key must be unique per view.
    const open = window.__frameOpen || (window.__frameOpen = {});
    window.__frameMore = window.__frameMore || ((el) => {
      const root = el.getRootNode(), key = el.dataset.key, was = el.classList.contains('is-open');
      root.querySelectorAll('.tap.is-open').forEach((x) => x.classList.remove('is-open'));
      Object.keys(open).forEach((k) => delete open[k]);
      if (was) return;
      el.classList.add('is-open');
      open[key] = Date.now() + 12000;
      setTimeout(() => {
        if (!(open[key] > Date.now())) root.querySelectorAll(`.tap[data-key="${key}"]`).forEach((x) => x.classList.remove('is-open'));
      }, 12100);
    });
    const isOpen = (key) => (open[key] > Date.now() ? ' is-open' : '');
    const tapAttr = (key) => ` data-key="${esc(key)}" onpointerup="__frameMore(this)"`;
    // rows: [[label, value HTML]]; empty values are left out
    const more = (title, rows, note) => `<div class="more">${title ? `<span class="label">${esc(title)}</span>` : ''}
      ${rows.filter((r) => r && r[1] != null && r[1] !== '').map((r) => `<div class="kv"><span>${esc(r[0])}</span><b>${r[1]}</b></div>`).join('')}
      ${note ? `<span class="kv-note">${note}</span>` : ''}</div>`;
    // Tooltips on charts: tips = [{x (0–100), h (HTML), y?}]
    window.__frameTip = window.__frameTip || ((ev, el) => {
      if (ev.type === 'pointermove' && ev.pointerType !== 'mouse') return;
      const tips = el.__tips || (el.__tips = JSON.parse(el.dataset.tips || '[]'));
      if (!tips.length) return;
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width * 100;
      const tip = tips.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
      const box = el.querySelector('.ch-tip'), mark = el.querySelector('.ch-mark'), dot = el.querySelector('.ch-dot');
      box.innerHTML = tip.h;
      box.style.left = tip.x + '%';
      box.style.transform = `translateX(${tip.x < 18 ? 0 : tip.x > 82 ? -100 : -50}%)`;
      if (tip.y != null) { mark.style.left = dot.style.left = tip.x + '%'; dot.style.top = tip.y + '%'; }
      el.classList.toggle('has-dot', tip.y != null);
      el.querySelectorAll('.bars > *').forEach((b, i) => b.classList.toggle('is-sel', i === tip.i));
      el.classList.add('is-tip');
      clearTimeout(el.__hide);
      if (ev.pointerType !== 'mouse') el.__hide = setTimeout(() => window.__frameTipHide(el), 6000);
    });
    window.__frameTipHide = window.__frameTipHide || ((el, ev) => {
      if (ev && ev.pointerType !== 'mouse') return;
      el.classList.remove('is-tip');
      el.querySelectorAll('.bars .is-sel').forEach((b) => b.classList.remove('is-sel'));
    });
    const TIP = '<span class="ch-mark"></span><span class="ch-dot"></span><div class="ch-tip"></div>';
    // attributes for a .ch-plot with tooltips; put TIP inside it. tips: [{x (0–100), h (HTML), y?, i? (bar index)}]
    const tipPlot = (tips) => (tips && tips.length
      ? ` data-tips="${esc(JSON.stringify(tips))}" onpointerup="__frameTip(event,this)" onpointermove="__frameTip(event,this)" onpointerleave="__frameTipHide(this,event)"`
      : '');
    // Area sparkline over the last `hours` hours (smooth Catmull-Rom curve).
    // opt: now (current value as last point), minSpan (smallest y range, keeps noise flat),
    //      unit/decimals (enables tooltips), line2 {rows, now, minSpan, unit, decimals} second series as a line.
    const spark = (rows, hours, opt) => {
      const o = opt || {};
      const t1 = Date.now(), t0 = t1 - (hours || 24) * 3600000;
      const f = (n) => n.toFixed(2);
      const cy = (y) => Math.max(4, Math.min(38, y));
      const curve = (list, now, minSpan) => {
        const r = (list || []).filter((x) => x.mean != null).map((x) => ({ t: typeof x.start === 'number' ? x.start : Date.parse(x.start), v: x.mean }));
        if (now != null && !isNaN(now)) r.push({ t: t1, v: Number(now) });
        if (r.length < 2) return null;
        const vs = r.map((x) => x.v);
        let min = Math.min(...vs), max = Math.max(...vs);
        const padY = Math.max(0, ((minSpan || 0) - (max - min)) / 2);
        min -= padY; max += padY;
        const span = max - min || 1;
        const P = r.map((x) => [Math.max(0, Math.min(100, (x.t - t0) / (t1 - t0) * 100)), 36 - ((x.v - min) / span) * 30]);
        if (P[0][0] > 0) P.unshift([0, P[0][1]]);
        let d = `M${f(P[0][0])},${f(P[0][1])}`;
        for (let i = 0; i < P.length - 1; i++) {
          const a = P[i - 1] || P[i], b = P[i], c = P[i + 1], e = P[i + 2] || c;
          d += ` C${f(b[0] + (c[0] - a[0]) / 6)},${f(cy(b[1] + (c[1] - a[1]) / 6))} ${f(c[0] - (e[0] - b[0]) / 6)},${f(cy(c[1] - (e[1] - b[1]) / 6))} ${f(c[0])},${f(c[1])}`;
        }
        return { r, P, d };
      };
      const main = curve(rows, o.now, o.minSpan);
      if (!main) return '';
      const { r, P, d } = main;
      const l2 = o.line2 ? curve(o.line2.rows, o.line2.now, o.line2.minSpan) : null;
      const x0 = f(P[0][0]), x1 = f(P[P.length - 1][0]);
      const paths = `<path class="spark-a" d="${d} L${x1},40 L${x0},40 Z"/>${l2 ? `<path class="spark-l2" d="${l2.d}"/>` : ''}<path class="spark-l" d="${d}"/>`;
      if (o.unit == null) return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
      const off = P.length - r.length;
      const at2 = (tt) => {
        const y = l2 && l2.r.find((z) => Math.abs(z.t - tt) < 1800000);
        return y ? ` · ${nf(y.v, o.line2.decimals || 0)}${o.line2.unit ? ' ' + esc(o.line2.unit) : ''}` : '';
      };
      const tips = r.map((x, i) => ({ x: P[i + off][0], y: P[i + off][1] / 40 * 100,
        h: `${x.t >= t1 ? t('now') : time(new Date(x.t))} · <b>${nf(x.v, o.decimals || 0)}${o.unit ? ' ' + esc(o.unit) : ''}</b>${at2(x.t)}` }));
      const stop = 'event.stopPropagation()';
      return `<div class="spark ch-plot" data-tips="${esc(JSON.stringify(tips))}" onpointerup="__frameTip(event,this);${stop}"
        onpointermove="__frameTip(event,this)" onpointerleave="__frameTipHide(this,event)" onpointerdown="${stop}" onclick="${stop}">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>${TIP}</div>`;
    };
    // Frozen sensor: at least 20 hourly values without any change
    const flat = (rows) => {
      const r = (rows || []).filter((x) => x.min != null && x.max != null);
      return r.length >= 20 && Math.max(...r.map((x) => x.max)) - Math.min(...r.map((x) => x.min)) < 0.05;
    };

    // ------------------------------------------------------------ dashboard
    // This dashboard's config (views, templates), from the Lovelace panel. Found once, then cached.
    const lovelace = () => {
      const find = (root, depth) => {
        if (!root || depth > 8) return null;
        for (const el of root.querySelectorAll('*')) {
          if (el.tagName === 'HA-PANEL-LOVELACE') return el;
          const hit = el.shadowRoot && find(el.shadowRoot, depth + 1);
          if (hit) return hit;
        }
        return null;
      };
      let p = window.__framePanel;
      if (!p || !p.isConnected) p = window.__framePanel = find(document, 0);
      return (p && p.lovelace && p.lovelace.config) || null;
    };
    // The views as rail entries: [{path, label, icon}] (views without a path or with `visible: false` are left out)
    const views = () => ((lovelace() || {}).views || []).filter((v) => v.path && v.visible !== false)
      .map((v) => ({ path: v.path, label: v.title || v.path, icon: v.icon || 'mdi:circle-small' }));

    // Optional modules' scripts next to frame.js (calendar.js, flights.js ...), loaded once per page with the same
    // ?v= as frame.js. Returns true once loaded; until then the card redraws when the script arrives.
    const load = (name) => {
      const L = window.__frameLoad || (window.__frameLoad = {});
      if (L[name] === true) return true;
      if (!L[name]) {
        L[name] = { cards: new Set() };
        import(DIR + name + V).then(() => {
          const w = L[name].cards;
          L[name] = true;
          w.forEach((c) => { if (c.isConnected) c.requestUpdate('_config'); });
        }).catch((e) => { console.error('Frame: could not load', name, e); L[name] = false; });
      }
      if (L[name] && L[name].cards && card && card.requestUpdate) L[name].cards.add(card);
      return false;
    };

    // optional/flights: planes overhead, switched on by `flights:` in the household settings (templates/frame.yaml)
    if (variables.flights && !window.__frameFlightsConfig) {
      window.__frameFlightsConfig = Object.assign({ dashboard: location.pathname.split('/')[1], dir: DIR, v: V, text: variables.text }, variables.flights);
      load('flights.js');
    }

    // ------------------------------------------------------------ actions
    window.__frameHass = hass;
    const moreInfo = (el, id) => el.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true }));
    window.__frameInfo = window.__frameInfo || ((el) => moreInfo(el, el.dataset.id));
    // Navigate inside the dashboard without reloading (rail): path relative to the dashboard
    window.__frameGo = window.__frameGo || ((path) => {
      const url = path.startsWith('/') ? path : `/${location.pathname.split('/')[1]}/${path}`;
      if (url === location.pathname) return;
      history.pushState(null, '', url);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
    });

    return { t, lang, h12, pad, esc, nf, time, clock, hourLabel, weekday, dateLong, dateShort, day0, dayDiff, dayLabel, when, dur,
      ok, fmt, num, nameOf, person, people, family, pstyle, avatar, cached, hist, changes, runs, forecast, events, agenda, firstWeekday,
      lit, glow, glowStyle, areaLights, coverPos, isOpen, tapAttr, more, TIP, tipPlot, spark, flat, moreInfo, lovelace, views, load };
  },
};

// Cards that inherit from `frame` (they have the fx variable) get the shared stylesheet
const isFrame = (card) => !!(card._config && card._config.variables && 'fx' in card._config.variables);
const adopt = (card) => {
  const root = card.shadowRoot;
  if (!root || root.__frameCss || !isFrame(card)) return;
  root.__frameCss = true;
  if (canAdopt) root.adoptedStyleSheets = [sheet, ...root.adoptedStyleSheets];
  else {
    const st = document.createElement('style');
    st.textContent = cssText;
    root.prepend(st);
  }
};
const patch = (BC) => {
  const P = BC.prototype;
  if (P.__frame) return;
  P.__frame = true;
  const cc = P.connectedCallback;
  P.connectedCallback = function () { cc.call(this); adopt(this); };
  const sc = P.setConfig;
  P.setConfig = function (c) { sc.call(this, c); adopt(this); };
  // button-card ignores state changes on cards with update_timer until the next tick.
  // Redraw those cards right away when one of their entities changes.
  if (typeof P._hasAnEntityChanged === 'function') {
    const su = P.shouldUpdate;
    P.shouldUpdate = function (ch) {
      if (su.call(this, ch)) return true;
      if (!this._updateTimerDuration || !this._hasAnEntityChanged(ch)) return false;
      if (this._expandTriggerGroups) this._expandTriggerGroups();
      return true;
    };
  }
};
// Cards that rendered before this file ran (button-card loaded first): style and redraw them
const refreshAll = () => {
  const walk = (root) => root.querySelectorAll('*').forEach((el) => {
    if (el.tagName === 'BUTTON-CARD' && el._config) { adopt(el); el.requestUpdate('_config'); }
    if (el.shadowRoot) walk(el.shadowRoot);
  });
  walk(document);
};

const define = customElements.define;
const existing = customElements.get('button-card');
if (existing) patch(existing);
else {
  customElements.define = function (name, cls, opts) {
    if (name === 'button-card') {
      customElements.define = define;
      patch(cls);
    }
    return define.call(this, name, cls, opts);
  };
}

try {
  const r = await fetch(DIR + 'frame.css' + V);
  cssText = r.ok ? await r.text() : '';
  if (sheet) sheet.replaceSync(cssText);
} catch (e) {
  console.error('frame.css', e);
}
if (existing) refreshAll();
else {
  // HACS usually registers button-card as its own resource; give it a moment, then load it ourselves
  const loaded = await Promise.race([customElements.whenDefined('button-card').then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  if (!loaded) await import(BUTTON_CARD).catch((e) => console.error('Frame: could not load button-card from', BUTTON_CARD, e));
  customElements.define = define;
  const BC = customElements.get('button-card');
  if (BC) { patch(BC); refreshAll(); }
}
console.info('%c FRAME %c starter runtime loaded ', 'background:#111;color:#F2EEE6;font-weight:700', 'color:#111');
