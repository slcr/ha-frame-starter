// Room window: tap a light tile with `area:` (frame_light). Every lamp of the room as its own row (tap switches,
// drag dims, hold for Home Assistant's dialog); tap a lamp's round icon for its colours: white levels in its range
// and a palette by hue. With optional/scenes there are tabs with scene pictures next to "Lamps": a tap spreads the
// scene's colours over the lamps, shuffled every time; dynamic ones keep moving them between the lamps.
// Loaded by frame.js on first use. Closes after 60 s without a touch, on Done or a tap outside.
const V = new URL(import.meta.url).search;
const DIR = new URL('.', import.meta.url).pathname;
const H = () => document.querySelector('home-assistant').hass;
const ico = (i) => `<ha-icon icon="${i}"></ha-icon>`;
const DYN = ico('mdi:motion-play-outline');
// the scene library (optional/scenes, scenes.py), loaded once per page; ?t= past the browser cache of /local
let LIB = null;
const library = () => LIB || (LIB = fetch(`${DIR}scenes/scenes.json?t=${Date.now()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
// the scene picked last, per room and per lamp, on this device only, while the lights are on
const ROOM_SCENE = {}, LAMP_SCENE = {};

// xy -> Kelvin (McCamy), for lamps that can only do white
const kelvin = ([x, y]) => {
  const n = (x - 0.332) / (0.1858 - y);
  return Math.round(Math.max(2000, Math.min(6500, 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33)));
};
// Kelvin -> colour on screen (after Tanner Helland)
const kRgb = (k) => {
  const t = k / 100, c = (v) => Math.round(Math.max(0, Math.min(255, v)));
  return [255, c(t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * (t - 60) ** -0.0755), c(t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04)].join(' ');
};
const shuffle = (a) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};
// The colour picker: 7 white levels, and 8 hues (red, orange, yellow, green, teal, blue, violet, pink) from strong to soft
const WHITE = [2200, 2700, 3000, 3500, 4300, 5000, 6500];
const HUES = [0, 28, 52, 115, 175, 215, 265, 320];
const SATS = [[100, '100% 58%'], [65, '90% 72%'], [35, '80% 85%']];

export const open = (el, vars) => {
  const root = el.getRootNode();
  if (root.querySelector('.ced--room')) return;
  const FX = () => window.frame.fx.call(null, H().states, H(), vars);
  const fx = FX(), t = fx.t, esc = fx.esc;
  const st = () => H().states;
  const ids0 = el.dataset.entity.split(','), title = el.dataset.room, area = el.dataset.area;
  // the room's name drops out of lamp names ("Living room floor lamp" -> "Floor lamp"), unless nothing would be left
  const words = [title, el.dataset.areaName].filter(Boolean).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const cut = words.length ? new RegExp(`(^|\\s)(${words.join('|')})(?=\\s|$)`, 'gi') : null;
  const name = (id) => {
    const full = ((st()[id] || {}).attributes || {}).friendly_name || id;
    const short = cut ? full.replace(cut, ' ').replace(/\s+/g, ' ').trim() : full;
    return short ? short.charAt(0).toUpperCase() + short.slice(1) : full;
  };
  const ok = (id) => st()[id] && ['on', 'off'].includes(st()[id].state);
  const modes = (id) => ((st()[id] || {}).attributes || {}).supported_color_modes || [];
  const isCol = (id) => modes(id).some((m) => ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(m));
  const isWhite = (id) => isCol(id) || modes(id).includes('color_temp');
  const hasCol = ids0.some(isCol), hasWhite = ids0.some(isWhite);
  const anyOn = () => ids0.some((id) => ok(id) && st()[id].state === 'on');

  // a lamp as a row; its colour fades over from the previous row in scope (fx.glowStyle)
  const row = (id, scope) => {
    const s = st()[id], a = (s && s.attributes) || {};
    const na = !ok(id), on = !na && s.state === 'on';
    const dim = !na && (a.supported_color_modes || []).some((m) => m !== 'onoff');
    const pct = on ? (a.brightness != null ? Math.round(a.brightness / 2.55) : 100) : 0;
    const sub = na ? t('unavailable') : on ? (a.brightness != null ? `${pct} %` : t('on')) : t('off');
    const g = FX().glowStyle([s], scope && scope.querySelector(`.lt[data-entity="${id}"]`));
    const i = ico(a.icon || (on ? 'mdi:lightbulb' : 'mdi:lightbulb-outline'));
    return `<div class="lt${on ? ' is-on' : ''}${na ? ' is-na' : ''}${dim ? ' can-dim' : ''}${pct <= 0 || pct >= 100 ? ' is-edge' : ''}" style="--pct:${pct}%;${g.style}"${g.attr}
      ${na ? '' : `data-entity="${id}" data-off="${esc(t('off'))}" onpointerdown="__frameLight(event,this)"`}><i class="lt-fill"></i>
      <span class="lt-ico"${!na && isWhite(id) ? ' data-pick' : ''}>${i}</span><b>${esc(name(id))}</b><span class="lt-sub">${esc(sub)}</span></div>`;
  };
  const lamps = (scope) => ids0.slice().sort((x, y) => (ok(y) - ok(x)) || name(x).localeCompare(name(y), fx.lang)).map((id) => row(id, scope)).join('');

  // Dynamic scenes (packages/frame_scenes.yaml): script.frame_scene_dynamic notes itself as "<area>:<context>"
  const dynamic = !!st()['script.frame_scene_dynamic'];
  const dynOn = () => ((st()['input_text.frame_scenes_dynamic'] || {}).state || '').split(' ').some((x) => x.startsWith(area + ':'));
  const stopDyn = () => H().callService('script', 'turn_on', { variables: { room: area } }, { entity_id: 'script.frame_scene_stop' });
  // Every tap spreads anew: the palette shuffled, the lamps in random order. Scenes with one colour (white light) go to
  // lamps with colour temperature as Kelvin, exactly the one on the tile (kv). dyn = seconds per colour step.
  // only = [lamp] from its colour picker: just that lamp; a dynamic scene then changes colours on it.
  // At most one dynamic scene runs per room; a new one (or a plain colour or scene) ends the running one.
  const applyScene = (sc, dyn, only) => {
    const pal = shuffle(sc.xy), calls = {}, col = [];
    shuffle(only || ids0.filter(ok)).forEach((id, i) => {
      const m = modes(id), xy = pal[i % pal.length], data = {};
      if (m.some((x) => x !== 'onoff')) data.brightness = Math.max(1, sc.bri);
      if (isCol(id) && (pal.length > 1 || !m.includes('color_temp'))) { data.xy_color = xy; col.push(id); }
      else if (isWhite(id)) data.color_temp_kelvin = sc.kv || kelvin(xy);
      const key = JSON.stringify(data);
      (calls[key] = calls[key] || []).push(id);
    });
    if (only) { LAMP_SCENE[only[0]] = { k: sc.k, t: Date.now() }; delete ROOM_SCENE[title]; }
    else { ROOM_SCENE[title] = { k: sc.k, t: Date.now() }; ids0.forEach((id) => { delete LAMP_SCENE[id]; }); }
    const run = Object.entries(calls).map(([data, entity_id]) =>
      H().callService('light', 'turn_on', Object.assign(JSON.parse(data), { transition: 1 }), { entity_id }));
    // start after the light commands: as a "foreign colour" they would otherwise end the new scene too
    if (dyn && col.length > 0) {
      return Promise.allSettled(run).then(() => H().callService('script', 'turn_on',
        { variables: { room: area, lights: col, colors: pal, step: dyn } }, { entity_id: 'script.frame_scene_dynamic' }));
    }
    if (dynOn()) run.push(stopDyn());
    return Promise.all(run);
  };
  // Scene tabs from the library. Without a colour lamp only the one-colour scenes (white), without colour temperature none.
  const tabsOf = (lib, col, white) => (!lib || !white ? [] : lib.tabs.map((x) => Object.assign({}, x, {
    groups: x.groups.filter((g) => dynamic || !g.dyn).map((g) => Object.assign({}, g, { items: g.items.filter((i) => col || i.xy.length === 1) })).filter((g) => g.items.length),
  })).filter((x) => x.groups.length));
  const tile = (x, dyn) => `<div class="rl-sc" data-scene="${esc(x.k)}"${dyn ? ` data-dyn="${dyn}"` : ''}${x.img ? '' : ` style="background:linear-gradient(135deg, rgb(${kRgb(x.kv || 2700)}), rgb(250 248 243))"`}>
    ${x.img ? `<img src="${DIR}scenes/${esc(x.img)}" loading="lazy" alt="">` : ''}${dyn ? `<i class="rl-dyn">${DYN}</i>` : ''}
    ${ico('mdi:check-circle').replace('<ha-icon', '<ha-icon class="rl-ok"')}<b>${esc(x.n)}${x.kv ? ` <small>${x.kv.toLocaleString(fx.lang)} K</small>` : ''}</b></div>`;
  const scenes = (x, one) => `${x.groups.map((g) => `<div class="label">${esc(g.n)}</div><div class="rl-scenes">${g.items.map((i) => tile(i, g.dyn)).join('')}</div>`).join('')}
    ${x.groups.some((g) => g.dyn) ? `<p class="rl-note">${DYN}<span>${esc(t(one ? 'dyn_lamp' : 'dyn_room'))}</span></p>` : ''}`;
  const subtab = (x) => `<span data-sub="${esc(x.k)}">${x.groups.some((g) => g.dyn) ? DYN : ''}${esc(x.n)}</span>`;

  // ---------- window
  const w = document.createElement('div');
  w.className = 'ced-wrap';
  w.innerHTML = `<div class="ced ced--room"><div class="ced-head"><b>${esc(title)}</b></div>
    <div class="ced-body"><div class="rl-pane" data-pane="lamps"><div class="rl-list">${lamps()}</div></div><div class="rl-pane rl-pick" data-pane="color" hidden></div></div>
    <div class="ced-actions"><button class="ced-btn rl-off">${esc(t('all_off'))}</button><button class="ced-btn ced-btn--ink" data-a="done">${esc(t('done'))}</button></div></div>`;
  root.appendChild(w);
  window.__frameGlowFlush(w);
  const box = w.querySelector('.ced-body'), list = box.querySelector('.rl-list'), offB = w.querySelector('.rl-off');

  // ---------- one lamp's colours: its row on top (dragging still dims), white levels and colours below.
  // Built once (sub tabs Colour | Scenes | Special), then only its row and the marks refresh, so tabs and scrolling stay.
  let pickId = null, pickT = 0, pickRow = '', lib = null, byK = {};
  const pickRowHtml = (id) => row(id, box.querySelector('[data-pick-row]'));
  const pickBody = (id) => {
    const a = ((st()[id] || {}).attributes) || {};
    const lo = a.min_color_temp_kelvin || 2000, hi = a.max_color_temp_kelvin || 6500;
    const ks = modes(id).includes('color_temp') || isCol(id) ? WHITE.filter((k) => k >= lo - 100 && k <= hi + 100) : [];
    const sw = (attr, bg, lab) => `<button class="rl-sw" ${attr} style="background:${bg}">${lab ? `<small>${lab}</small>` : ''}</button>`;
    const tabs = tabsOf(lib, isCol(id), isWhite(id));
    pickRow = pickRowHtml(id);
    return `<div class="rl-list" data-pick-row>${pickRow}</div>
      ${tabs.length ? `<div class="seg rl-tabs rl-sub"><span class="is-on" data-sub="color">${esc(t('colour'))}</span>${tabs.map(subtab).join('')}</div>` : ''}
      <div class="rl-subpane" data-subpane="color">
      ${ks.length ? `<div class="label">${esc(t('white_light'))}</div><div class="rl-sws">${ks.map((k) => sw(`data-k="${k}"`, `rgb(${kRgb(k)})`, `${k.toLocaleString(fx.lang)} K`)).join('')}</div>` : ''}
      ${isCol(id) ? `<div class="label">${esc(t('colour'))}</div><div class="rl-sws rl-sws--hue">${SATS.map(([sat, sl]) =>
        HUES.map((h) => sw(`data-hs="${h},${sat}"`, `hsl(${h} ${sl})`)).join('')).join('')}</div>` : ''}</div>
      ${tabs.map((x) => `<div class="rl-subpane rl-sp" data-subpane="${esc(x.k)}" hidden>${scenes(x, true)}</div>`).join('')}`;
  };
  // marked: this lamp's scene (while it's on), else the nearest white level or colour
  const pickMarks = () => {
    const p = box.querySelector('[data-pane="color"]'), s = st()[pickId] || {}, a = s.attributes || {}, on = s.state === 'on';
    const ls = LAMP_SCENE[pickId], cur = ls && (on || Date.now() - ls.t < 5000) ? ls.k : null;
    p.querySelectorAll('.rl-sc').forEach((x) => x.classList.toggle('is-on', x.dataset.scene === cur));
    const ks = [...p.querySelectorAll('[data-k]')].map((x) => +x.dataset.k);
    const kNow = !cur && on && a.color_mode === 'color_temp' && a.color_temp_kelvin;
    const kOn = kNow && ks.reduce((b, k) => (Math.abs(k - kNow) < Math.abs(b - kNow) ? k : b), ks[0]);
    // colour: the nearest swatch, but only when it's really close
    const hsNow = !cur && on && a.color_mode !== 'color_temp' && a.hs_color;
    const dist = (x) => {
      const [h, sat] = x.dataset.hs.split(',').map(Number), dh = Math.min(Math.abs(hsNow[0] - h), 360 - Math.abs(hsNow[0] - h));
      return dh < 25 && Math.abs(hsNow[1] - sat) < 20 ? dh + Math.abs(hsNow[1] - sat) : Infinity;
    };
    const hsOn = hsNow && [...p.querySelectorAll('[data-hs]')].reduce((b, x) => (dist(x) < (b ? dist(b) : Infinity) ? x : b), null);
    p.querySelectorAll('.rl-sw').forEach((x) => x.classList.toggle('is-on', x.dataset.k ? +x.dataset.k === kOn : x === hsOn));
  };
  const showPick = (id) => {
    pickId = id;
    const p = box.querySelector('[data-pane="color"]');
    p.innerHTML = pickBody(id);
    window.__frameGlowFlush(p);
    pickMarks();
    box.querySelectorAll('.rl-pane').forEach((x) => { x.hidden = x !== p; });
    // the room tabs apply to the whole room: hidden while a lamp is picked. The title becomes "‹ Room – Lamp";
    // all of it leads back (big enough for a finger on the wall tablet)
    w.classList.add('is-picking');
    const tb = w.querySelector('.ced-head > b');
    tb.dataset.back = '';
    tb.innerHTML = `<span class="rl-chev">${ico('mdi:chevron-left')}</span>${esc(title)}<span class="rl-lamp">– ${esc(name(id))}</span>`;
  };
  w.__pick = showPick;
  const back = () => {
    pickId = null;
    w.classList.remove('is-picking');
    const tb = w.querySelector('.ced-head > b');
    delete tb.dataset.back;
    tb.textContent = title;
    box.querySelectorAll('.rl-pane').forEach((x) => { x.hidden = x.dataset.pane !== 'lamps'; });
    w.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('is-on', x.dataset.tab === 'lamps'));
  };
  const setColor = (b) => {
    const data = b.dataset.k ? { color_temp_kelvin: +b.dataset.k } : { hs_color: b.dataset.hs.split(',').map(Number) };
    box.querySelector('[data-pane="color"]').querySelectorAll('.rl-sw, .rl-sc').forEach((x) => x.classList.toggle('is-on', x === b));
    pickT = Date.now();
    // a colour of your own: the scene no longer applies, a moving scene stops
    delete ROOM_SCENE[title];
    delete LAMP_SCENE[pickId];
    if (dynOn()) stopDyn();
    H().callService('light', 'turn_on', data, { entity_id: pickId }).catch(() => {});
  };
  // just picked: marked even before the lamps report their new state
  const mark = () => {
    const pick = ROOM_SCENE[title], fresh = !!pick && Date.now() - pick.t < 5000, cur = pick && (anyOn() || fresh) ? pick.k : null;
    box.querySelectorAll('.rl-sp[data-pane] .rl-sc').forEach((x) => x.classList.toggle('is-on', x.dataset.scene === cur));
    // "All off" follows the lamps; usable right after a scene, before they report as on
    offB.disabled = !anyOn() && !fresh;
  };
  offB.disabled = !anyOn();

  // the scene tabs, next to the room's name
  if (vars.scenes) {
    library().then((l) => {
      lib = l;
      const tabs = tabsOf(lib, hasCol, hasWhite);
      if (!tabs.length || !w.isConnected) return;
      tabs.forEach((x) => x.groups.forEach((g) => g.items.forEach((i) => { byK[i.k] = i; })));
      const head = w.querySelector('.ced-head');
      head.classList.add('rl-head');
      head.insertAdjacentHTML('beforeend', `<div class="seg rl-tabs"><span class="is-on" data-tab="lamps">${esc(t('lamps'))}</span>${tabs.map((x) =>
        `<span data-tab="${esc(x.k)}">${x.groups.some((g) => g.dyn) ? DYN : ''}${esc(x.n)}</span>`).join('')}</div>`);
      box.insertAdjacentHTML('beforeend', tabs.map((x) => `<div class="rl-pane rl-sp" data-pane="${esc(x.k)}" hidden>${scenes(x)}</div>`).join(''));
      mark();
    });
  }

  let idle;
  const tick = setInterval(() => {
    if (!w.isConnected) { clearInterval(tick); return; }
    if (box.querySelector('.is-dimming')) return;
    // compares the generated HTML (the browser reads innerHTML back normalised)
    const html = lamps(list);
    if (html !== last) { list.innerHTML = html; last = html; window.__frameGlowFlush(list); }
    if (pickId) {
      const rh = pickRowHtml(pickId), pr = box.querySelector('[data-pick-row]');
      if (rh !== pickRow) { pr.innerHTML = rh; pickRow = rh; window.__frameGlowFlush(pr); }
      // just picked: keep the mark for 3 s, until the lamp reports the new value
      if (Date.now() - pickT > 3000) pickMarks();
    }
    mark();
  }, 1000);
  let last = lamps(list);
  const close = () => { clearInterval(tick); clearTimeout(idle); w.remove(); };
  const touch = () => { clearTimeout(idle); idle = setTimeout(close, 60000); };
  touch();
  w.addEventListener('pointerdown', touch);
  w.addEventListener('pointerup', (e) => {
    if (e.target === w || e.target.closest('[data-a="done"]')) { close(); return; }
    if (e.target.closest('.rl-off')) {
      if (offB.disabled) return;
      delete ROOM_SCENE[title];
      ids0.forEach((id) => { delete LAMP_SCENE[id]; });
      mark();
      offB.disabled = true;
      if (dynOn()) stopDyn();
      H().callService('light', 'turn_off', {}, { entity_id: ids0.filter(ok) }).catch(() => { offB.disabled = !anyOn(); });
      return;
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      w.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('is-on', x === tab));
      box.querySelectorAll('.rl-pane').forEach((x) => { x.hidden = x.dataset.pane !== tab.dataset.tab; });
      pickId = null;
      return;
    }
    if (e.target.closest('[data-back]')) { back(); return; }
    const sub = e.target.closest('[data-sub]');
    if (sub) {
      const p = box.querySelector('[data-pane="color"]');
      p.querySelectorAll('[data-sub]').forEach((x) => x.classList.toggle('is-on', x === sub));
      p.querySelectorAll('[data-subpane]').forEach((x) => { x.hidden = x.dataset.subpane !== sub.dataset.sub; });
      return;
    }
    const b = e.target.closest('.rl-sw');
    if (b) { setColor(b); return; }
    const tl = e.target.closest('[data-scene]'), sc = tl && byK[tl.dataset.scene];
    if (!sc) return;
    // from a lamp's colour picker: only that lamp
    const one = tl.closest('[data-pane="color"]');
    (one || box).querySelectorAll(one ? '.rl-sw, .rl-sc' : '.rl-sp[data-pane] .rl-sc').forEach((x) => x.classList.toggle('is-on', x === tl));
    offB.disabled = false;
    if (one) pickT = Date.now();
    applyScene(sc, +tl.dataset.dyn || 0, one ? [pickId] : null).catch(() => {});
  });
};
