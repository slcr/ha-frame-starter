// Planes overhead (optional/flights), from the Flightradar24 integration (HACS): when a new aircraft shows up in
// its sensor, a plane crosses the whole Frame screen in its real direction (north = up), as far from the centre
// as it passes your home, for as long as you'd see it in the sky (higher than min_elevation above the horizon).
// Jet, small plane, freighter or helicopter (with a spinning rotor); the shadow gets softer the higher it flies.
// A small tag shows flight and route; tapping it opens a flight card (route with progress, times, delay,
// aircraft, altitude, speed) over a flight through the clouds behind that aircraft (clouds.js, WebGL).
//
// A layer of its own right under <body>, above everything: switching views leaves the plane flying. Hidden
// outside the Frame dashboard. Loaded by frame.js when `flights:` is set in templates/frame.yaml:
//   flights: { entity: sensor.flightradar24_current_in_area, radius_km: 5 }
// radius_km must match the radius you set in the integration (it uses metres there).
// Try it from the browser console: __frameFly({ heading: 250, flight_number: "LH123", altitude: 35000, ground_speed: 450 })
const CFG = window.__frameFlightsConfig || {};
const ENTITY = CFG.entity || "sensor.flightradar24_current_in_area";
const RADIUS_KM = Number(CFG.radius_km) || 5;
const MIN_ELEVATION = Number(CFG.min_elevation) || 20;
const MAX_AT_ONCE = Number(CFG.max_at_once) || 3;
const DASH = "/" + (CFG.dashboard || location.pathname.split("/")[1]);
const DIR = CFG.dir || "/local/frame/";
const MIN_SEC = 60;
const REPEAT_MIN = 10;

const V = CFG.v || "";
const KINDS = {
  jet: { img: "flights/jet.webp", w: 144, h: 137, trail: [{ left: 33, top: 42.7, width: 33.9 }] },
  heavy: { img: "flights/heavy.webp", w: 200, h: 158, trail: [{ left: 25, top: 42, width: 50 }, { left: 35.5, top: 35.6, width: 29 }] },
  small: { img: "flights/small.webp", w: 100, h: 79 },
  heli: { img: "flights/heli.webp", w: 112, h: 112, rotor: { size: 105, x: 56, y: 38.3 } },
};

const MITFLUG = {
  jet: { img: "flights/chase-jet.webp", w: 1536, h: 969, red: [1.6, 29], strobe: [[6.05, 43.6], [95.4, 50.4]], green: [95.4, 50.4], beacon: [60.45, 35.86], tail: [89.2, 80] },
  heavy: { img: "flights/chase-heavy.webp", w: 1536, h: 873, box: "left: 6vw; bottom: -6vh; width: 98vw", red: [2.3, 33.3], green: [99.8, 37], beacon: [58.9, 41], tail: [87.4, 78.6] },
  small: { img: "flights/chase-small.webp", w: 1517, h: 1000, red: [1.5, 32.8], green: [96.2, 49.2], beacon: [88.7, 4.5], tail: [89.4, 90] },
};
const TRAIL_FT = 20000;
const AIRLINER = /^(A3|A[12][019]N|A2|B7|B3[789]M|BCS|E1[79]|E2|E7|E9|CRJ|SU9|MD|B46|AT[47]|DH8|A40)/;
const HEAVY = /^(A12[45]|A225|IL[79]|C17|C5)/;
const NOT_HELI = /^A1\d(?!9$)/;
const kindOf = (f, ft, kt) => {
  if (f.aircraft_category === "Helicopter" && !NOT_HELI.test(f.aircraft_code || "")) return { ...KINDS.heli };
  if (kt && kt < 200 && ft < 15000) return { ...KINDS.small };
  if (HEAVY.test(f.aircraft_code || "")) return { ...KINDS.heavy, trail: ft >= TRAIL_FT ? KINDS.heavy.trail : null };
  const k = AIRLINER.test(f.aircraft_code || "") ? 1 : 0.78;
  return { ...KINDS.jet, w: KINDS.jet.w * k, h: KINDS.jet.h * k, trail: ft >= TRAIL_FT ? KINDS.jet.trail : null };
};

const CSS = `
  :host { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; overflow: hidden;
    --ink: #111111; --paper: #F2EEE6; --sans: 'Archivo', system-ui, sans-serif; }
  :host(.is-off) { visibility: hidden; }
  .fl { position: absolute; left: 0; top: 0; width: 0; height: 0; will-change: transform; }
  .fl-ship { position: absolute; }
  .fl-body { position: relative; width: 100%; height: 100%; }
  .fl-body > img { display: block; width: 100%; height: 100%; }
  .fl-body > .fl-rotor { position: absolute; width: auto; height: auto; animation: fl-spin .9s linear infinite; }
  @keyframes fl-spin { to { transform: rotate(360deg); } }
  .fl-trail { position: absolute; height: 340px;
    background: linear-gradient(rgb(17 17 17 / .16), rgb(17 17 17 / 0)) left / 3px 100% no-repeat,
      linear-gradient(rgb(17 17 17 / .16), rgb(17 17 17 / 0)) right / 3px 100% no-repeat; }
  .fl-tag { position: absolute; display: flex; align-items: center; gap: 9px; padding: 5px 5px 5px 11px; border-radius: 12px; white-space: nowrap;
    background: var(--ink); color: var(--paper); font-family: var(--sans); font-size: 12px; line-height: 1.2; -webkit-font-smoothing: antialiased;
    box-shadow: 0 4px 4px rgb(0 0 0 / .05), 0 14px 14px rgb(0 0 0 / .08);
    cursor: pointer; pointer-events: auto; -webkit-tap-highlight-color: transparent; }
  .fl-tag::before { content: ""; position: absolute; inset: -10px; }
  .fl-tag > div { display: flex; flex-direction: column; gap: 1px; }
  .fl-tag b { font-size: 13px; font-weight: 800; }
  .fl-tag b small { font-size: 11px; font-weight: 600; color: rgb(242 238 230 / .65); margin-left: 5px; }
  .fl-tag span { color: rgb(242 238 230 / .65); }
  .fl-info { flex: none; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%; display: grid; place-items: center;
    background: rgb(242 238 230 / .14); color: var(--paper); cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .fl-tag:active .fl-info { background: rgb(242 238 230 / .28); }
  .fl-info svg { width: 16px; height: 16px; }

  .fc-scrim { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; pointer-events: auto;
    background: rgb(17 17 17 / .22); animation: fc-fade .25s ease-out; -webkit-tap-highlight-color: transparent; }
  .fc-scrim.is-out { animation: fc-fade .18s ease-in reverse forwards; }
  .fc-scrim.has-sky { background: none; animation-duration: .6s; }
  .fc-scrim.has-sky.is-out { animation-duration: .3s; }
  .fc-sky { position: absolute; inset: 0; pointer-events: none; }
  .fc-sky > canvas { display: block; width: 100%; height: 100%; }
  .fc-chase { position: absolute; left: 18vw; bottom: -12vh; width: 112vw; animation: fc-chase-in 2.2s cubic-bezier(.16, .8, .24, 1) both; }
  .fc-sway { animation: fc-sway 11.3s ease-in-out infinite alternate; }
  .fc-bob { position: relative; transform-origin: 62% 58%; animation: fc-bob 6.7s ease-in-out infinite alternate; }
  .fc-bob > img { display: block; width: 100%; height: auto; }
  @keyframes fc-chase-in { from { opacity: 0; transform: translate(18%, 12%) scale(1.12); } 30% { opacity: 1; } }
  @keyframes fc-sway { from { transform: translateX(-12px); } to { transform: translateX(10px); } }
  @keyframes fc-bob { from { transform: translateY(-6px) rotate(-.7deg); } to { transform: translateY(7px) rotate(.5deg); } }
  .fc-tint { display: none; position: absolute; inset: 0; background: #6B7A99; mix-blend-mode: multiply;
    -webkit-mask: var(--img) center / 100% 100% no-repeat; mask: var(--img) center / 100% 100% no-repeat; }
  .is-night .fc-tint { display: block; }
  .fc-l { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; opacity: 0; }
  .fc-l.is-red { background: #FF7A66; box-shadow: 0 0 8px 3px rgb(255 60 40 / .55), 0 0 26px 10px rgb(255 50 30 / .25); }
  .fc-l.is-green { background: #8CFFB0; box-shadow: 0 0 8px 3px rgb(40 255 120 / .5), 0 0 26px 10px rgb(30 255 110 / .22); }
  .fc-l.is-tail { background: #FFF6E0; box-shadow: 0 0 8px 3px rgb(255 245 220 / .5); }
  .is-night .fc-l.is-red, .is-night .fc-l.is-green, .is-night .fc-l.is-tail { opacity: 1; }
  .fc-l.is-strobe { background: #fff; box-shadow: 0 0 10px 4px rgb(255 255 255 / .9), 0 0 50px 20px rgb(220 235 255 / .45); animation: fc-strobe 1.25s linear infinite; }
  .fc-l.is-beacon { background: #FF5A40; box-shadow: 0 0 8px 3px rgb(255 50 30 / .8), 0 0 30px 12px rgb(255 40 20 / .35); animation: fc-beacon 1.1s ease-out infinite; }
  @keyframes fc-strobe { 0%, 3% { opacity: 1; } 3.1%, 9% { opacity: 0; } 9.1%, 12% { opacity: 1; } 12.1%, 100% { opacity: 0; } }
  @keyframes fc-beacon { 0% { opacity: 1; } 18%, 100% { opacity: 0; } }
  .fc-scrim > .fc { position: relative; }
  .fc { width: 540px; max-width: 100%; box-sizing: border-box; padding: 22px 26px 24px; border-radius: 26px;
    background: var(--ink); color: var(--paper); font-family: var(--sans); -webkit-font-smoothing: antialiased; line-height: 1.2;
    box-shadow: 0 10px 12px rgb(0 0 0 / .07), 0 30px 40px rgb(0 0 0 / .12), 0 60px 80px rgb(0 0 0 / .14);
    animation: fc-in .35s cubic-bezier(.2, .9, .3, 1.1); }
  .fc-scrim.is-out .fc { animation: fc-in .18s ease-in reverse forwards; }
  @keyframes fc-fade { from { opacity: 0; } }
  @keyframes fc-in { from { opacity: 0; transform: translateY(14px) scale(.96); } }
  .fc-mute { color: rgb(242 238 230 / .55); }
  .fc-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; font-size: 15px; font-weight: 700; }
  .fc-head > :first-child { letter-spacing: .06em; text-transform: uppercase; }
  .fc-head > :nth-child(2) { text-align: center; }
  .fc-x { justify-self: end; width: 38px; height: 38px; margin: -6px -10px -6px 0; padding: 0; border: 0; border-radius: 50%; display: grid; place-items: center;
    background: rgb(242 238 230 / .1); color: var(--paper); cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .fc-x:active { background: rgb(242 238 230 / .22); }
  .fc-x svg { width: 20px; height: 20px; }
  .fc-route { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; margin: 26px 0 4px; }
  .fc-ap { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .fc-ap:last-child { text-align: right; align-items: flex-end; }
  .fc-ap b { font-size: 58px; font-weight: 800; font-stretch: 85%; letter-spacing: -.02em; line-height: .9; }
  .fc-ap span { font-size: 15px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fc-ap span + span { font-variant-numeric: tabular-nums; }
  .fc-arc { width: 100%; height: auto; overflow: visible; }
  .fc-km { text-align: center; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; margin-top: -2px; }
  .fc-one { margin: 22px 0 6px; font-size: 26px; font-weight: 800; }
  .fc-halo { transform-box: fill-box; transform-origin: center; opacity: 0; }
  .fc-arc.is-there .fc-halo { animation: fc-pulse 2s ease-out infinite; }
  @keyframes fc-pulse { 0% { opacity: .35; transform: scale(.5); } 100% { opacity: 0; transform: scale(1.8); } }
  .fc-foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-top: 22px; }
  .fc-foot > div { display: flex; flex-direction: column; gap: 6px; }
  .fc-foot > div:last-child { text-align: right; align-items: flex-end; }
  .fc-st { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 700; color: #6FD08C; }
  .fc-st::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .fc-st.is-late { color: #F2A85F; }
  .fc-big { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .fc-small { font-size: 15px; font-weight: 600; }
  .fc-facts { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 14px; margin-top: 20px; padding-top: 16px; border-top: 1px solid rgb(242 238 230 / .14); }
  .fc-facts div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .fc-facts small { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgb(242 238 230 / .5); }
  .fc-facts b { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

if (!window.__frameFlightLayer) {
  const host = document.createElement("div");
  host.id = "frame-flights";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS}</style>`;
  document.body.appendChild(host);
  window.__frameFlightLayer = host;

  const onFrame = () => location.pathname.startsWith(DASH + "/") || location.pathname === DASH;
  const route = () => host.classList.toggle("is-off", !onFrame());
  window.addEventListener("location-changed", route);
  window.addEventListener("popstate", route);
  route();

  const hass = () => (document.querySelector("home-assistant") || {}).hass;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const lang = () => ((hass() || {}).locale || {}).language || navigator.language;
  const nf = (n) => n.toLocaleString(lang());
  const imperial = () => (((hass() || {}).config || {}).unit_system || {}).length === "mi";
  const T = Object.assign({ plane: "Plane", from: "from {0}", to: "to {0}", late: "{0} min late", early: "{0} min early", on_time: "On time",
    landing_soon: "Landing soon", landing_in: "Landing in {0}", flight_time: "Flight time", aircraft: "Aircraft", altitude: "Altitude",
    speed: "Speed", left: "{0} to go", close: "Close", info: "Flight info", flight: "Flight {0}" }, CFG.text || {});
  const t = (k, ...a) => String(T[k]).replace(/\{(\d)\}/g, (_, i) => a[i]);
  const wpRunning = () => {
    let wp = window.__frameWp;
    if (!wp || !wp.isConnected) {
      const ha = document.querySelector("home-assistant"), main = ha && ha.shadowRoot && ha.shadowRoot.querySelector("home-assistant-main");
      wp = window.__frameWp = main && main.shadowRoot && main.shadowRoot.querySelector("wallpanel-view");
    }
    return !!wp && typeof wp.screensaverRunning === "function" && !!wp.screensaverRunning();
  };

  const shadow = (ft) => {
    const t = Math.sqrt(Math.max(0, Math.min(1, ft / 40000)));
    const d = 10 + 50 * t, blur = 1 + 15 * t, a = 0.26 - 0.16 * t, r = (n) => n.toFixed(1);
    return `filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / .28)) drop-shadow(${r(d * 0.6)}px ${r(d * 0.8)}px ${r(blur)}px rgb(0 0 0 / ${a.toFixed(3)}))`;
  };

  const label = (f) => f.flight_number || f.callsign || f.aircraft_registration || t("plane");
  const ICON = {
    info: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 9h2V7h-2m1 13c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m0-18A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m-1 15h2v-6h-2v6Z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"/></svg>`,
    plane: `<path d="M20.56 3.91c.59.59.59 1.54 0 2.12l-3.89 3.89 2.12 9.19-1.41 1.42-3.88-7.43L9.6 17l.36 2.47-1.07 1.06-1.76-3.18-3.19-1.77L5 14.5l2.5.37L11.37 11 3.94 7.09l1.42-1.41 9.19 2.12 3.89-3.89c.56-.58 1.56-.58 2.12 0Z"/>`,
  };
  const dist = (k) => (imperial() ? `${nf(Math.round(k * 0.621371))} mi` : `${nf(Math.round(k))} km`);
  const km = (a, b, c, d) => {
    const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(x));
  };
  const hm = (x) => new Date(x * 1000).toLocaleTimeString(lang(), { hour: "2-digit", minute: "2-digit" });
  const dur = (min) => { min = Math.max(0, Math.round(min)); return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`; };

  let sky = null;
  const skyLoad = () => sky || (sky = import(DIR + "clouds.js" + V).then((m) => m.make()).catch(() => null));

  let closeCard = null;
  const card = (f0) => {
    if (closeCard) closeCard();
    const h0 = hass(), list = ((h0 && h0.states[ENTITY] || {}).attributes || {}).flights || [];
    const f = list.find((x) => x.id === f0.id) || f0;
    const now = Date.now() / 1000, ft = Number(f.altitude) || 0, kt = Number(f.ground_speed) || 0;
    const from = f.airport_origin_city || f.airport_origin_name, to = f.airport_destination_city || f.airport_destination_name;
    const fromC = f.airport_origin_code_iata || f.airport_origin_code_icao, toC = f.airport_destination_code_iata || f.airport_destination_code_icao;
    const dep = f.time_real_departure || f.time_estimated_departure || f.time_scheduled_departure;
    const arr = f.time_estimated_arrival || f.time_scheduled_arrival;
    const has = (...v) => v.every((x) => x != null && x !== "");
    let total = null, left = null, p = null;
    if (has(f.airport_origin_latitude, f.airport_origin_longitude, f.airport_destination_latitude, f.airport_destination_longitude)) {
      total = km(f.airport_origin_latitude, f.airport_origin_longitude, f.airport_destination_latitude, f.airport_destination_longitude);
      if (has(f.latitude, f.longitude)) {
        const done = km(f.airport_origin_latitude, f.airport_origin_longitude, f.latitude, f.longitude);
        left = Math.min(total, km(f.latitude, f.longitude, f.airport_destination_latitude, f.airport_destination_longitude));
        p = done / Math.max(1, done + left);
      }
    }
    if (p == null && dep && arr && arr > dep) p = (now - dep) / (arr - dep);
    p = p == null ? null : Math.max(0, Math.min(1, p));
    const rest = arr ? (arr - now) / 60 : left != null && kt ? left / (kt * 1.852) * 60 : null;
    const sA = f.time_scheduled_arrival, eA = f.time_estimated_arrival;
    const late = sA && eA ? Math.round((eA - sA) / 60) : null;
    const status = late == null ? "" : late > 5 ? `<span class="fc-st is-late">${t("late", late)}</span>`
      : late < -5 ? `<span class="fc-st">${t("early", -late)}</span>` : `<span class="fc-st">${t("on_time")}</span>`;
    const sD = f.time_scheduled_departure, flight = sD && sA ? (sA - sD) / 60 : dep && arr ? (arr - dep) / 60 : null;
    const airline = f.airline_short || f.airline || "";
    const model = f.aircraft_model || f.aircraft_code;
    const facts = [
      model && [t("aircraft"), model + (f.aircraft_registration ? ` · ${f.aircraft_registration}` : "")],
      ft && [t("altitude"), imperial() ? `${nf(Math.round(ft / 100) * 100)} ft` : `${nf(Math.round(ft * 0.3048 / 100) * 100)} m`],
      kt && [t("speed"), imperial() ? `${nf(Math.round(kt * 1.15078 / 10) * 10)} mph` : `${nf(Math.round(kt * 1.852 / 10) * 10)} km/h`],
    ].filter(Boolean);
    const ap = (code, city, t) => `<div class="fc-ap"><b>${esc(code || "—")}</b><span class="fc-mute">${esc(city || "")}</span>${t ? `<span class="fc-mute">${hm(t)}</span>` : ""}</div>`;
    const both = (fromC || from) && (toC || to);
    const route = both ? `<div class="fc-route">${ap(fromC || String(from).slice(0, 3).toUpperCase(), from, dep)}
        <svg class="fc-arc" viewBox="0 0 200 62">
          <path class="fc-rest" d="M8 50 Q100 -6 192 50" fill="none" stroke="rgb(242 238 230 / .38)" stroke-width="2.4" stroke-dasharray="5 6" stroke-linecap="round"/>
          <path class="fc-done" d="M8 50 Q100 -6 192 50" fill="none" stroke="var(--paper)" stroke-width="2.6" stroke-linecap="round"/>
          <circle cx="8" cy="50" r="4.5" fill="var(--paper)"/>
          <circle cx="192" cy="50" r="4.5" fill="var(--ink)" stroke="var(--paper)" stroke-width="2.4"/>
          ${p == null ? "" : `<g class="fc-plane"><circle class="fc-halo" r="8" fill="var(--paper)"/><g class="fc-icon" fill="var(--paper)">${ICON.plane}</g></g>`}
        </svg>${ap(toC || String(to).slice(0, 3).toUpperCase(), to, arr)}</div>
        ${total ? `<div class="fc-km fc-mute">${dist(total)}${left != null ? ` · ${t("left", dist(left))}` : ""}</div>` : ""}`
      : from || to ? `<div class="fc-one">${from ? t("from", esc(from)) : t("to", esc(to))}</div>` : "";
    const land = rest == null ? "" : rest < 1 ? t("landing_soon") : t("landing_in", dur(rest));
    const wrap = document.createElement("div");
    wrap.className = "fc-scrim";
    wrap.innerHTML = `<div class="fc" role="dialog" aria-label="${t("flight", esc(label(f)))}">
      <div class="fc-head"><span class="fc-mute">${esc(label(f))}</span><span class="fc-mute">${esc(airline)}</span>
        <button class="fc-x" aria-label="${t("close")}">${ICON.close}</button></div>
      ${route}
      ${status || land || flight ? `<div class="fc-foot"><div>${status}${land ? `<span class="fc-big">${land}</span>` : ""}</div>
        <div>${flight ? `<span class="fc-small fc-mute">${t("flight_time")}</span><span class="fc-big">${dur(flight)}</span>` : ""}</div></div>` : ""}
      ${facts.length ? `<div class="fc-facts">${facts.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
    </div>`;
    root.appendChild(wrap);
    const M = MITFLUG[Object.keys(KINDS).find((k) => KINDS[k].img === kindOf(f, ft, kt).img)];
    const chase = M && ((night) => {
      const src = `${DIR}${M.img}${V}`, at = ([x, y]) => `left: ${x}%; top: ${y}%`;
      const el = document.createElement("div");
      el.className = `fc-chase${night ? " is-night" : ""}`;
      if (M.box) el.style.cssText = M.box;
      el.innerHTML = `<div class="fc-sway"><div class="fc-bob" style="--img: url('${src}')"><img src="${src}" alt="" width="${M.w}" height="${M.h}"><i class="fc-tint"></i>
        <i class="fc-l is-red" style="${at(M.red)}"></i><i class="fc-l is-green" style="${at(M.green)}"></i><i class="fc-l is-tail" style="${at(M.tail)}"></i>
        ${(M.strobe || [M.red, M.green]).map((p) => `<i class="fc-l is-strobe" style="${at(p)}"></i>`).join("")}
        <i class="fc-l is-beacon" style="${at(M.beacon)}"></i></div></div>`;
      return el;
    });
    skyLoad().then((c) => {
      if (!c || !wrap.isConnected || wrap.classList.contains("is-out")) return;
      wrap.classList.add("has-sky");
      const box = document.createElement("div");
      box.className = "fc-sky";
      wrap.prepend(box);
      const night = (h0 && h0.states["sun.sun"] || {}).state === "below_horizon";
      c.start(box, night);
      if (chase) box.appendChild(chase(night));
    });
    wrap.addEventListener("pointermove", (e) => sky && sky.then((c) => c && c.point(e)));

    let raf = 0, timer = 0;
    const close = () => {
      if (closeCard !== close) return;
      closeCard = null;
      cancelAnimationFrame(raf); clearTimeout(timer); removeEventListener("keydown", key);
      wrap.classList.add("is-out");
      setTimeout(() => wrap.remove(), 200);
    };
    const key = (e) => { if (e.key === "Escape") close(); };
    closeCard = close;
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest(".fc-x")) close(); });
    addEventListener("keydown", key);
    timer = setTimeout(close, 120000);

    const arc = wrap.querySelector(".fc-arc"), done = wrap.querySelector(".fc-done"), plane = wrap.querySelector(".fc-plane");
    if (!arc) return;
    const L = done.getTotalLength();
    const draw = (q) => {
      done.setAttribute("stroke-dasharray", `${L * q} ${L}`);
      if (!plane) return;
      const a = done.getPointAtLength(L * q), b = done.getPointAtLength(Math.min(L, L * q + 0.5)), c = done.getPointAtLength(Math.max(0, L * q - 0.5));
      const deg = Math.atan2(b.y - c.y, b.x - c.x) * 180 / Math.PI;
      plane.setAttribute("transform", `translate(${a.x} ${a.y})`);
      plane.querySelector(".fc-icon").setAttribute("transform", `rotate(${deg + 45}) scale(1.1) translate(-12 -12)`);
    };
    const target = p == null ? 0 : p;
    draw(0);
    const t0 = performance.now() + 250, ms = 600 + 1400 * target;
    const step = (t) => {
      const k = Math.max(0, Math.min(1, (t - t0) / ms)), e = 1 - (1 - k) ** 3;
      draw(target * e);
      if (k < 1) raf = requestAnimationFrame(step); else arc.classList.add("is-there");
    };
    raf = requestAnimationFrame(step);
  };
  window.__frameFlightCard = card;

  const fly = (f) => {
    const h0 = hass();
    if (!h0 || f.heading == null || root.querySelectorAll(".fl").length >= MAX_AT_ONCE) return false;
    const lat0 = h0.config.latitude, lon0 = h0.config.longitude;
    const W = innerWidth, H = innerHeight, M = 340, h = Number(f.heading) * Math.PI / 180;
    const ux = Math.sin(h), uy = -Math.cos(h);
    let px = 0, py = 0, miss = 0;
    if (f.latitude != null && f.longitude != null) {
      const dx = (f.longitude - lon0) * 111.32 * Math.cos(lat0 * Math.PI / 180), dy = -(f.latitude - lat0) * 110.57;
      const along = dx * ux + dy * uy, k = Math.min(W, H) * 0.4;
      px = Math.max(-k, Math.min(k, (dx - along * ux) / RADIUS_KM * k));
      py = Math.max(-k, Math.min(k, (dy - along * uy) / RADIUS_KM * k));
      miss = Math.hypot(dx - along * ux, dy - along * uy);
    }
    const cx = W / 2 + px, cy = H / 2 + py;
    const span = (c, u, max) => (Math.abs(u) < 1e-6 ? [-Infinity, Infinity] : [(-M - c) / u, (max + M - c) / u].sort((a, b) => a - b));
    const [ax, bx] = span(cx, ux, W), [ay, by] = span(cy, uy, H);
    const t0 = Math.max(ax, ay), t1 = Math.min(bx, by);
    let nx = -uy, ny = ux;
    if (ny < -0.01 || (Math.abs(ny) <= 0.01 && nx < 0)) { nx = -nx; ny = -ny; }
    const al = (v) => (v < -0.35 ? "-100%" : v > 0.35 ? "0" : "-50%");
    const ft = Number(f.altitude) || 0, kt = Number(f.ground_speed) || 0;
    const from = f.airport_origin_city || f.airport_origin_name || f.airport_origin_code_iata;
    const to = f.airport_destination_city || f.airport_destination_name || f.airport_destination_code_iata;
    const fromC = f.airport_origin_code_iata || from, toC = f.airport_destination_code_iata || to;
    const route = fromC && toC ? `${fromC} → ${toC}` : fromC ? t("from", fromC) : toC ? t("to", toC) : "";
    const airline = f.airline_short || f.airline;
    const K = kindOf(f, ft, kt), box = `left: ${-K.w / 2}px; top: ${-K.h / 2}px; width: ${K.w}px; height: ${K.h}px;`;
    const turn = `transform: rotate(${f.heading}deg)`, off = Math.max(K.w, K.h) / 2 + 10;
    const T = K.trail, R = K.rotor;
    const el = document.createElement("div");
    el.className = "fl";
    el.innerHTML = `${T ? `<div class="fl-ship" aria-hidden="true" style="${box} ${turn}">${T.map((t) => `<i class="fl-trail" style="left: ${t.left}%; top: ${t.top}%; width: ${t.width}%"></i>`).join("")}</div>` : ""}
      <div class="fl-ship fl-air" aria-hidden="true" style="${box} ${shadow(ft)}"><div class="fl-body" style="${turn}"><img src="${DIR}${K.img}${V}" alt="">
        ${R ? `<img class="fl-rotor" src="${DIR}flights/rotor.webp${V}" alt="" style="left: ${R.x - R.size / 2}px; top: ${R.y - R.size / 2}px; width: ${R.size}px; height: ${R.size}px">` : ""}</div></div>
      <div class="fl-tag" style="left: ${nx * off}px; top: ${ny * off}px; transform: translate(${al(nx)}, ${al(ny)})"><div>
        <b>${esc(label(f))}${airline ? `<small>${esc(airline)}</small>` : ""}</b>
        ${route ? `<span>${esc(route)}</span>` : ""}</div>
        <button class="fl-info" aria-label="${t("info")}">${ICON.info}</button></div>`;
    el.querySelector(".fl-tag").addEventListener("click", () => card(f));
    root.appendChild(el);
    const D = ft * 0.3048 / 1000 / Math.tan(MIN_ELEVATION * Math.PI / 180);
    const km = 2 * Math.sqrt(Math.max(D * D - miss * miss, (0.3 * D) ** 2));
    const sec = Math.max(MIN_SEC, Math.min(300, km / (Math.max(40, kt || 430) * 1.852) * 3600));
    const len = t1 - t0, ms = sec * 1000 * len / Math.max(1, len - 2 * (M - 120));
    const at = (t) => `translate(${cx + t * ux}px, ${cy + t * uy}px)`;
    el.animate([{ transform: at(t0) }, { transform: at(t1) }], { duration: ms, easing: "linear", fill: "forwards" })
      .finished.finally(() => el.remove());
    return true;
  };
  window.__frameFly = fly;

  const seen = {};
  const check = () => {
    const h0 = hass(), st = h0 && h0.states;
    if (!st) return;
    Object.keys(seen).forEach((k) => { if (Date.now() - seen[k] > 36e5) delete seen[k]; });
    if (document.hidden || !onFrame() || (CFG.pause_on_screensaver && wpRunning())) return;
    const s0 = st[ENTITY] || {}, list = (s0.attributes || {}).flights || [];
    const fresh = Date.now() - new Date(s0.last_updated).getTime() < 2 * 60000;
    const due = (id) => !seen[id] || (fresh && Date.now() - seen[id] > REPEAT_MIN * 60000);
    list.filter((f) => f.id && due(f.id) && !f.on_ground && f.heading != null).forEach((f, i) => {
      const prev = seen[f.id];
      seen[f.id] = Date.now();
      setTimeout(() => { if (!fly(f)) { if (prev) seen[f.id] = prev; else delete seen[f.id]; } }, 50 + i * 2500);
    });
  };
  setInterval(check, 3000);
  check();
}
