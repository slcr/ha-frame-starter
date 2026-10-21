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

// Clock menu (frame_rail): the pages listed in `menu_pages`, then a link to Home Assistant's settings. It lives
// outside the rail so it stays visible over the phone's scrolling top bar. frame_rail puts the entries into
// window.__frameMenuData = {items: [{path, label, icon}], active, settings: {href, label, icon}, aria}.
let closeFrameMenu = null;
window.__frameMenu = (event, anchor) => {
  event.stopPropagation();
  if (event.button > 0) return;
  if (closeFrameMenu) { closeFrameMenu(); return; }
  const D = window.__frameMenuData || { items: [] };
  const rail = anchor.getRootNode(), host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:1000;';
  const root = host.attachShadow({ mode: 'open' });
  window.__frameStyle(root);
  const menu = document.createElement('nav');
  menu.className = 'rail-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', D.aria || '');
  const entries = D.items.map((x) => Object.assign({}, x, { href: `/${location.pathname.split('/')[1]}/${x.path}` }));
  if (D.settings) entries.push(Object.assign({ settings: true }, D.settings));
  entries.forEach((item) => {
    if (item.settings && entries.length > 1) {
      const divider = document.createElement('div');
      divider.className = 'rail-menu-divider';
      divider.setAttribute('role', 'separator');
      menu.appendChild(divider);
    }
    const link = document.createElement('a');
    link.href = item.href;
    link.setAttribute('role', 'menuitem');
    link.tabIndex = -1;
    if (item.path && item.path === D.active) link.setAttribute('aria-current', 'page');
    link.innerHTML = `<ha-icon icon="${item.icon}"></ha-icon><span></span>`;
    link.querySelector('span').textContent = item.label;
    link.addEventListener('click', (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      close(false);
      // settings: a full load, so kiosk-mode brings back Home Assistant's sidebar
      if (item.settings) location.href = item.href;
      else window.__frameGo(item.path);
    });
    menu.appendChild(link);
  });
  root.appendChild(menu);
  const close = (restore = true) => {
    host.remove();
    const trigger = rail.querySelector('.rail-clock');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (restore) trigger.focus({ preventScroll: true });
    }
    window.removeEventListener('resize', dismiss);
    window.removeEventListener('popstate', dismiss);
    window.removeEventListener('location-changed', dismiss);
    window.removeEventListener('scroll', dismiss, true);
    closeFrameMenu = null;
  };
  const dismiss = () => close(false);
  closeFrameMenu = close;
  host.addEventListener('pointerdown', (ev) => { if (!ev.composedPath().includes(menu)) close(); });
  root.addEventListener('keydown', (ev) => {
    const links = [...menu.querySelectorAll('a')], index = links.indexOf(root.activeElement);
    if (ev.key === 'Escape' || ev.key === 'Tab') {
      ev.preventDefault();
      close();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(ev.key)) {
      ev.preventDefault();
      const next = ev.key === 'Home' ? 0 : ev.key === 'End' ? links.length - 1
        : (index + (ev.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links[next].focus({ preventScroll: true });
    }
  });
  document.body.appendChild(host);
  anchor.setAttribute('aria-expanded', 'true');
  // tablet: to the right of the clock, bottom aligned; phone: under the top bar, right aligned
  const a = anchor.getBoundingClientRect(), m = menu.getBoundingClientRect();
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const left = mobile ? a.right - m.width : a.right + 12;
  const top = mobile ? a.bottom + 10 : a.bottom - m.height;
  menu.style.left = `${Math.max(12, Math.min(left, window.innerWidth - m.width - 12))}px`;
  menu.style.top = `${Math.max(12, Math.min(top, window.innerHeight - m.height - 12))}px`;
  (menu.querySelector('[aria-current="page"]') || menu.querySelector('a')).focus({ preventScroll: true });
  window.addEventListener('resize', dismiss);
  window.addEventListener('popstate', dismiss);
  window.addEventListener('location-changed', dismiss);
  window.addEventListener('scroll', dismiss, true);
};

// UI strings. Override any of them in the `frame` template: variables.text: { today: Heute, ... }
const TEXT = {
  today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', now: 'Now', all_day: 'All day', until: 'until {0}',
  home: 'Home', away: 'Away', unknown: 'Unknown', unavailable: 'Unavailable', never: 'Never',
  up_next: 'Up next', happening: 'Happening now', min_left: 'min left', min: 'min', until_time: 'until', at: '',
  nothing_planned: 'Nothing planned.', enjoy: 'Enjoy the quiet.', next_7_days: 'Next 7 days',
  no_events: 'No events', no_events_sub: 'in the next 7 days', today_all_day: 'Today',
  weather_na: 'Weather not available', forecast_na: 'No hourly forecast', high: 'High', low: 'Low', feels: 'Feels like',
  rain_from: 'Rain from {0}.', rain_now: 'Rain until {0}.', snow_from: 'Snow from {0}.', snow_now: 'Snow until {0}.',
  sleet_from: 'Sleet from {0}.', sleet_now: 'Sleet until {0}.', storm_from: 'Thunderstorms from {0}.', storm_now: 'Thunderstorms until {0}.',
  snow: 'Snow.', sleet: 'Sleet.', storm: 'Thunderstorms.', windy: 'Strong gusts.', sunscreen: 'Sunscreen.',
  wear_winter: 'Winter coat, hat.', wear_coat: 'Warm coat.', wear_jacket: 'Jacket.', wear_light: 'Light jacket.', wear_sweater: 'Long sleeves.',
  wear_tshirt: 'T-shirt.', wear_layers: 'Layers.', wear_umbrella: 'Umbrella.', wear_rainjacket: 'Rain jacket.',
  // weather window (weather.js)
  weather: 'Weather', close: 'Close', next_24h: 'Next 24 hours', next_days: 'Next days', dry: 'Dry', some_rain: 'Some rain',
  gusts_to: 'Gusts up to {0}', up_to: 'up to {0}', sunrise: 'Sunrise', sunset: 'Sunset', rain_today: 'Rain today', wind: 'Wind', wind_from: 'from {0}',
  gusts_today: 'Gusts today', uv: 'UV index', uv_0: 'low', uv_1: 'moderate', uv_2: 'high', uv_3: 'very high', compass: 'N,NE,E,SE,S,SW,W,NW',
  wx_now_0: 'Tonight', wx_now_1: 'This morning', wx_now_2: 'This afternoon', wx_now_3: 'This evening',
  wx_part_0: 'Overnight', wx_part_1: 'Morning', wx_part_2: 'Afternoon', wx_part_3: 'Evening',
  wx_tom_0: 'Tomorrow night', wx_tom_1: 'Tomorrow morning', wx_tom_2: 'Tomorrow afternoon', wx_tom_3: 'Tomorrow evening',
  on: 'On', off: 'Off', open: 'Open', closed: 'Closed', opening: 'opening', closing: 'closing',
  n_of_m_on: '{0} of {1} on', all_off: 'All off', lights_on: '{0} on', all_open: 'All open', all_closed: 'All closed',
  n_of_m_open: '{0} of {1} open', n_of_m_closed: '{0} of {1} closed',
  windows_doors: 'Windows & doors', all_closed_big: 'All closed', n_open: '{0} open', open_since: 'Open since',
  opened_today: 'Opened today', last_opened: 'Last opened',
  countdown: 'Countdown', christmas: 'Christmas', christmas_eve: 'Christmas Eve', easter: 'Easter', new_year: 'New Year',
  birthday: 'Birthday', turns: 'turns {0}', days: 'days', from_day: 'from {0}', day_off: '1 day off', days_off: '{0} days off',
  lamps: 'Lamps', done: 'Done', colour: 'Colour', white_light: 'White light',
  dyn_room: 'Dynamic: the colours slowly move between the lamps. Tap again to shuffle.', dyn_lamp: 'Dynamic: the colours slowly change on this lamp.',
  door: 'Front door', door_open: 'Door open', battery: 'Battery',
  more_pages: 'More pages and settings', ask: 'Ask', settings: 'Settings', profile: 'Profile',
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
    // ------------------------------------------------------------ weather
    const WX_ICON = { 'clear-night': 'mdi:weather-night', cloudy: 'mdi:weather-cloudy', exceptional: 'mdi:alert-circle-outline',
      fog: 'mdi:weather-fog', hail: 'mdi:weather-hail', lightning: 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy',
      partlycloudy: 'mdi:weather-partly-cloudy', pouring: 'mdi:weather-pouring', rainy: 'mdi:weather-rainy', snowy: 'mdi:weather-snowy',
      'snowy-rainy': 'mdi:weather-snowy-rainy', sunny: 'mdi:weather-sunny', windy: 'mdi:weather-windy', 'windy-variant': 'mdi:weather-windy-variant' };
    // worse weather wins when several hours share a slot
    const wxRank = (c) => ['clear-night', 'sunny', 'partlycloudy', 'cloudy', 'fog', 'windy', 'windy-variant', 'rainy', 'snowy-rainy', 'snowy',
      'hail', 'pouring', 'lightning', 'lightning-rainy', 'exceptional'].indexOf(c);
    const wxIcon = (c, night) => (c === 'partlycloudy' && night ? 'mdi:weather-night-partly-cloudy' : c === 'sunny' && night ? 'mdi:weather-night' : WX_ICON[c] || 'mdi:weather-cloudy');
    // A condition as Home Assistant names it, in the user's language
    const wxName = (id, c) => (states[id] && hass && hass.formatEntityState ? hass.formatEntityState(Object.assign({}, states[id], { state: c })) : c);
    // Units of a weather entity; k converts its wind speed to km/h, mm its precipitation to mm
    const wxUnits = (id) => {
      const a = (states[id] || {}).attributes || {};
      const wind = String(a.wind_speed_unit || 'km/h'), precip = String(a.precipitation_unit || 'mm');
      return { temp: String(a.temperature_unit || '°C'), wind, precip,
        k: { 'm/s': 3.6, mph: 1.609, kn: 1.852, 'ft/s': 1.097 }[wind] || 1, mm: precip === 'in' ? 25.4 : 1 };
    };
    // Hourly forecast from the current hour: [{t, temp, feel, cond, pop, mm, mmMm, gust, gustKmh, gustReal, uv}]
    // gust falls back to the wind speed when the integration has no gusts (gustReal stays empty then)
    const wxHours = (id) => {
      const u = wxUnits(id), t0 = Date.now() - 3600000;
      return forecast(id, 'hourly').map((x) => {
        const gust = x.wind_gust_speed != null ? x.wind_gust_speed : x.wind_speed;
        return { t: new Date(x.datetime), gustReal: x.wind_gust_speed, temp: x.temperature, feel: x.apparent_temperature != null ? x.apparent_temperature : x.temperature,
          cond: x.condition, pop: x.precipitation_probability || 0, mm: x.precipitation || 0, mmMm: (x.precipitation || 0) * u.mm,
          gust, gustKmh: gust == null ? 0 : gust * u.k, uv: x.uv_index };
      }).filter((x) => x.t.getTime() > t0);
    };
    // wet = a rain/snow condition, likely rain or a measurable amount
    const wet = (x) => /rain|pour|snow|hail|lightning/.test(x.cond || '') || x.pop >= 50 || (x.mmMm != null ? x.mmMm : x.mm) >= 0.3;
    // What to wear, from the feels-like temperature of the next 12 hours (daytime hours when there are some).
    // say = clothing, extra = rain/snow, gusts or sunscreen, figs = pictures in www/frame/wx (weather variant first,
    // then the plain outfit). Thresholds in °C: variables.wear (household settings).
    const WEAR = Object.assign({ winter: 0, coat: 6, jacket: 12, light: 17, sweater: 22 }, variables.wear || {});
    const FIGS = {
      winter: { say: 'wear_winter', rain: 'winter-rain', snow: 'winter-snow' }, warm: { say: 'wear_coat', rain: 'warm-rain' },
      jacket: { say: 'wear_jacket', rain: 'jacket-rain', wind: 'jacket-wind' }, light: { say: 'wear_light', rain: 'light-rain', wind: 'light-wind' },
      longsleeve: { say: 'wear_sweater', rain: 'longsleeve-rain', sun: 'longsleeve-sun' }, tshirt: { say: 'wear_tshirt', rain: 'tshirt-rain', sun: 'tshirt-sun' },
    };
    const outfit = (id) => {
      const none = { say: '', extra: [], figs: [] };
      if (!id || !states[id]) return none;
      const c = /F/.test(wxUnits(id).temp) ? (v) => (v - 32) / 1.8 : (v) => v;
      const win = wxHours(id).slice(0, 12);
      const day = win.filter((x) => x.t.getHours() >= 7 && x.t.getHours() < 22);
      const feels = (day.length ? day : win).map((x) => c(x.feel)).filter(Number.isFinite);
      if (!feels.length) return none;
      const lo = Math.min(...feels), hi = Math.max(...feels);
      const fig = lo < WEAR.winter ? 'winter' : lo < WEAR.coat ? 'warm' : lo < WEAR.jacket ? 'jacket' : lo < WEAR.light ? 'light' : lo < WEAR.sweater ? 'longsleeve' : 'tshirt';
      const extra = [];
      const rain = win.findIndex(wet);
      const windy = Math.max(0, ...win.map((x) => x.gustKmh)) >= (variables.gusts_from || 50);
      const uv = Math.max(0, ...win.map((x) => x.uv || 0)) || ((forecast(id, 'daily')[0] || {}).uv_index || 0);
      const sunny = rain < 0 && uv >= 6 && new Date().getHours() < 16;
      const cond = rain >= 0 ? win[rain].cond || '' : '';
      const kind = /lightning/.test(cond) ? 'storm' : cond === 'snowy' ? 'snow' : /snowy-rainy|hail/.test(cond) ? 'sleet' : 'rain';
      if (rain === 0) {
        const dry = win.findIndex((x) => !wet(x));
        extra.push(dry > 0 ? t(`${kind}_now`, hourLabel(win[dry].t)) : kind === 'rain' ? t(windy ? 'wear_rainjacket' : 'wear_umbrella') : t(kind));
      } else if (rain > 0) extra.push(t(`${kind}_from`, hourLabel(win[rain].t)));
      if (windy) extra.push(t('windy'));
      else if (sunny) extra.push(t('sunscreen'));
      // no umbrella picture in gusts or thunderstorms; snow only where there is a snow picture
      const F = FIGS[fig];
      const variant = windy ? F.wind : kind === 'storm' ? null : rain >= 0 ? (kind === 'snow' ? F.snow : kind === 'sleet' ? null : F.rain) : sunny ? F.sun : null;
      // pictures that just failed to load (figImg) are skipped for an hour
      const miss = window.__frameNoFig || {};
      return { say: t(hi - lo >= 8 ? 'wear_layers' : F.say), extra, figs: [variant, fig].filter((f) => f && !(miss[f] > Date.now() - 36e5)) };
    };
    // The outfit picture as <img>: when a file is missing it tries the next one, then the image goes away
    const figImg = (figs) => {
      if (!figs.length) return '';
      const src = (n) => `${DIR}wx/${n}.webp${V}`;
      const onerr = `(window.__frameNoFig = window.__frameNoFig || {})[this.dataset.f] = Date.now();
        const [n, ...rest] = this.dataset.next.split(' ').filter(Boolean);
        if (n) { this.dataset.f = n; this.dataset.next = rest.join(' '); this.src = '${DIR}wx/' + n + '.webp${V}'; }
        else this.parentNode.remove();`;
      return `<img src="${src(figs[0])}" data-f="${figs[0]}" data-next="${figs.slice(1).join(' ')}" alt="" onerror="${esc(onerr)}">`;
    };
    // Tap on a light tile with `area:`: the room window (room.js, loaded on first use)
    window.__frameRoom = (el) => import(DIR + 'room.js' + V).then((m) => m.open(el, variables))
      .catch((e) => console.error('Frame: could not load room.js', e));
    // Tap on frame_weather: the weather window (weather.js, loaded on first use)
    window.__frameWxOpen = (el, id) => import(DIR + 'weather.js' + V).then((m) => m.open(el, id, variables))
      .catch((e) => console.error('Frame: could not load weather.js', e));
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
    // Fold out: tapping an element with data-fold="key" toggles is-open (shows .fold-body); closes after 2 min.
    // isFolded(key) keeps it open across redraws.
    const folds = window.__frameFolds || (window.__frameFolds = {});
    window.__frameFold = window.__frameFold || ((el) => {
      const box = el.closest('[data-fold]'), key = box.dataset.fold, root = el.getRootNode();
      const on = !box.classList.contains('is-open');
      box.classList.toggle('is-open', on);
      if (!on) { delete folds[key]; return; }
      folds[key] = Date.now() + 120000;
      setTimeout(() => {
        if (folds[key] > Date.now()) return;
        delete folds[key];
        root.querySelectorAll(`[data-fold="${key}"]`).forEach((x) => x.classList.remove('is-open'));
      }, 120100);
    });
    const isFolded = (key) => (folds[key] > Date.now() ? ' is-open' : '');
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

    // A file next to frame.js (www/frame/…) with the same ?v=; absolute paths and URLs stay as they are
    const asset = (p) => (/^(\/|https?:)/.test(p) ? p : DIR + p + V);
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
    // Ask: Assist in Frame style from the rail (assist.js), switched on by `ask:` in the household settings
    if (variables.ask && !window.__frameAskConfig) {
      window.__frameAskConfig = Object.assign({ dashboard: location.pathname.split('/')[1], text: { ask: t('ask') } }, variables.ask);
      load('assist.js');
    }
    // optional/timer: kitchen timer behind the big clock, switched on by `timer:` in the household settings
    if (variables.timer && !window.__frameTimerConfig) {
      window.__frameTimerConfig = Object.assign({ dashboard: location.pathname.split('/')[1], dir: DIR, v: V, text: variables.text }, variables.timer);
      load('timer.js');
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
      wxIcon, wxRank, wxName, wxUnits, wxHours, wet, outfit, figImg,
      lit, glow, glowStyle, areaLights, coverPos, isOpen, isFolded, asset, tapAttr, more, TIP, tipPlot, spark, flat, moreInfo, lovelace, views, load };
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
  // Lifecycle callbacks are read once by customElements.define(), so the connectedCallback wrapper does
  // nothing when button-card was defined before this file ran. willUpdate is an ordinary Lit method,
  // runs before every render and after the shadow root exists, so it catches every card in both cases.
  const wu = P.willUpdate;
  P.willUpdate = function (ch) { if (wu) wu.call(this, ch); adopt(this); };
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

// The stylesheet for Frame's own layers outside the cards (kitchen timer)
window.__frameStyle = (root) => {
  if (sheet) root.adoptedStyleSheets = [sheet];
  else { const st = document.createElement('style'); st.textContent = cssText; root.prepend(st); }
};

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
