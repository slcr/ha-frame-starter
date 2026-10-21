// Kitchen timer: tap the big clock (frame_clock) to open it. The time left, big, inside a dial: drag the ring to set
// the time (one turn = 60 min, several turns work), the arc shrinks as it runs down. Presets start right away;
// sound and speakers are remembered for next time.
// The timer itself runs in Home Assistant (packages/frame_timer.yaml), and so does the ringing on your speakers.
// "This device" also rings here in the browser, at the device's volume (iOS doesn't let pages set it), and only
// after it was touched once (autoplay rules).
// When the timer is done, the window opens by itself on every device showing Frame. While the window is closed,
// a floating bar (like the mini player) shows the time left.
// Loaded by frame.js when `timer:` is set in the household settings (templates/frame.yaml).
const C = window.__frameTimerConfig || {};
const DIR = C.dir || '/local/frame/';
const T = 'timer.frame_timer', RING = 'input_boolean.frame_timer_ringing';
const SOUND = 'input_select.frame_timer_sound', BOX = 'input_text.frame_timer_speakers';
// Names as in the options of input_select.frame_timer_sound and the files in www/frame/timer/
const SOUNDS = ['gong', 'bells', 'ringer', 'beep', 'marimba', 'alarm'];
const SPEAKERS = (C.speakers || []).map((s) => (typeof s === 'string' ? { entity: s, name: s } : s));
const PRESETS = C.presets || [
  { name: 'Tea', min: 4, icon: '🍵' }, { name: 'Soft egg', min: 6, icon: '🥚' }, { name: 'Bread rolls', min: 8, icon: '🥖' },
  { name: 'Hard egg', min: 10, icon: '🥚' }, { name: 'Pasta', min: 11, icon: '🍝' }, { name: 'Pizza', min: 12, icon: '🍕' },
  { name: 'Rice', min: 20, icon: '🍚' }, { name: 'Potatoes', min: 25, icon: '🥔' },
];
const MAX = 3 * 3600;
const LS = { last: 'frame-timer-last', here: 'frame-timer-here', pos: 'frame-timer-pos' };

// UI strings; override them with `text:` in the household settings like Frame's own
const TEXT = Object.assign({
  timer: 'Kitchen timer', close: 'Close', duration: 'Timer duration', start: 'Start', stop: 'Stop', pause: 'Pause', resume: 'Resume',
  add_min: '+{0} min', snooze: 'One more min', done: 'Done!', ringing: 'Kitchen timer is ringing', paused: 'Paused',
  paused_tap: 'Paused · tap to resume', tap_start: 'Tap to start', drop_restart: 'Let go to restart', drop_start: 'Let go, then Start',
  done_at: 'Done at {0}', quick: 'Quick start', sound: 'Sound', listen: 'Listen', rings_on: 'Rings on', rings_on_speakers: 'Rings on · 100 %',
  this_device: 'This device', min: 'min',
  sound_gong: 'Gong', sound_bells: 'Bells', sound_ringer: 'Kitchen ringer', sound_beep: 'Beep', sound_marimba: 'Marimba', sound_alarm: 'Alarm',
}, C.text || {});
const t = (k, ...a) => String(TEXT[k] == null ? k : TEXT[k]).replace(/\{(\d)\}/g, (_, i) => (a[i] == null ? '' : a[i]));

const hass = () => (document.querySelector('home-assistant') || {}).hass;
const call = (d, s, data) => hass().callService(d, s, data);
const icon = (i) => `<ha-icon icon="${i}"></ha-icon>`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pad = (n) => String(n).padStart(2, '0');
const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } return v; };
// "0:10:00" -> s
const hms = (v) => { const m = /^(\d+):(\d\d):(\d\d)/.exec(String(v || '')); return m ? (+m[1] * 60 + +m[2]) * 60 + +m[3] : 0; };
const dur = (s) => `${Math.floor(s / 3600)}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
// 754 -> "12:34", 4000 -> "1:06:40"
const clock = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`);
const hhmm = (ms) => {
  const loc = (hass() && hass().locale) || {};
  const h12 = loc.time_format === '12' ? true : loc.time_format === '24' ? false : undefined;
  return new Date(ms).toLocaleTimeString(loc.language || navigator.language, { hour: 'numeric', minute: '2-digit', hour12: h12 });
};
// Only on the Frame dashboard (the timer also rings while you are elsewhere in Home Assistant, but stays out of the way)
const onFrame = () => location.pathname.split('/')[1] === C.dashboard;

// ---------- sound on this device. AudioContext only after a touch (iOS), then it stays open.
let ctx = null;
const bufs = {};
const unlock = () => {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== 'running') ctx.resume();
  } catch (e) { ctx = null; }
};
const load = (n) => bufs[n] || (bufs[n] = fetch(`${DIR}timer/${n}.mp3`).then((r) => r.arrayBuffer())
  .then((a) => new Promise((ok, bad) => ctx.decodeAudioData(a, ok, bad))).catch((e) => { delete bufs[n]; throw e; }));
let playing = null;
const play = (n) => {
  if (!ctx) return;
  load(n).then((b) => {
    if (playing) try { playing.stop(); } catch (e) { /* already over */ }
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start();
    playing = src;
  }, () => {});
};

// ---------- state from Home Assistant
const read = () => {
  const h = hass(), s = h && h.states[T];
  const ring = !!(h && h.states[RING] && h.states[RING].state === 'on');
  const st = s ? s.state : 'unavailable', a = s ? s.attributes : {};
  const left = st === 'active' ? Math.max(0, Math.round((Date.parse(a.finishes_at) - Date.now()) / 1000))
    : st === 'paused' ? hms(a.remaining) : 0;
  const sound = (h && h.states[SOUND] && h.states[SOUND].state) || SOUNDS[0];
  const box = String((h && h.states[BOX] && h.states[BOX].state) || '').split(',').map((x) => x.trim()).filter((x) => x.startsWith('media_player.'));
  return { st, ring, left, total: hms(a.duration), end: st === 'active' ? Date.parse(a.finishes_at) : null, sound, box };
};

// ---------- window
let ui = null;
const open = () => {
  if (ui) return ui;
  const host = document.createElement('div');
  host.id = 'frame-timer';
  host.style.cssText = 'position:relative;z-index:900;';
  const root = host.attachShadow({ mode: 'open' });
  if (window.__frameStyle) window.__frameStyle(root);
  root.innerHTML = `<div class="ced-wrap dv-wrap tm-wrap"><div class="ced dv tm">
      <div class="tm-head"><span class="label">${icon('mdi:timer-outline')}${esc(t('timer'))}</span>
        <button class="ced-x" data-a="close" aria-label="${esc(t('close'))}">${icon('mdi:close')}</button></div>
      <div class="tm-main">
        <div class="tm-dial" role="slider" aria-label="${esc(t('duration'))}" aria-valuemin="0" aria-valuemax="${MAX}">
          <svg viewBox="0 0 520 520" aria-hidden="true">
            <circle class="tm-track" cx="260" cy="260" r="218"/>
            <g class="tm-ticks">${Array.from({ length: 60 }, (_, i) => {
              const a = i / 60 * 2 * Math.PI, r0 = i % 5 ? 176 : 164, r1 = 186;
              return `<line class="${i % 5 ? '' : 'is-5'}" x1="${260 + r0 * Math.sin(a)}" y1="${260 - r0 * Math.cos(a)}" x2="${260 + r1 * Math.sin(a)}" y2="${260 - r1 * Math.cos(a)}"/>`;
            }).join('')}</g>
            <circle class="tm-arc" cx="260" cy="260" r="218" transform="rotate(-90 260 260)"/>
            <g class="tm-knob"><circle r="30"/><path d="M-8 -9v18M0 -9v18M8 -9v18"/></g>
          </svg>
          <button class="tm-core" data-a="core"><b class="num tm-big"></b><span class="tm-sub"></span></button>
        </div>
        <div class="tm-side"></div>
      </div>
    </div></div>`;
  document.body.appendChild(host);
  const w = root.firstChild, dial = root.querySelector('.tm-dial'), arc = root.querySelector('.tm-arc'), knob = root.querySelector('.tm-knob');
  const big = root.querySelector('.tm-big'), sub = root.querySelector('.tm-sub'), side = root.querySelector('.tm-side');
  const CIRC = 2 * Math.PI * 218;
  let sel = ls(LS.last) || 600, drag = null, idle, lastSide = '', lastRing = false;

  const close = () => { clearInterval(tick); clearTimeout(idle); clearTimeout(ringT); host.remove(); ui = null; drawMini(); };
  // closes after 2 min without a touch, unless the timer is running or ringing
  const poke = () => { clearTimeout(idle); idle = setTimeout(() => { const r = read(); if (r.st === 'idle' && !r.ring) close(); else poke(); }, 120000); };

  const start = (s) => {
    s = Math.max(15, Math.min(MAX, Math.round(s)));
    sel = s;
    ls(LS.last, s);
    call('input_boolean', 'turn_off', { entity_id: RING });
    return call('timer', 'start', { entity_id: T, duration: dur(s) });
  };
  const stop = () => { call('input_boolean', 'turn_off', { entity_id: RING }); return call('timer', 'cancel', { entity_id: T }); };

  const draw = () => {
    const r = read(), run = r.st === 'active' || r.st === 'paused';
    const v = drag && !(drag.run && drag.moved < 4) ? drag.v : r.ring ? 0 : run ? r.left : sel;
    // arc: the minutes of the current hour, full from 60 min
    const p = v <= 0 ? 0 : v % 3600 === 0 || v > 3600 ? 1 : (v % 3600) / 3600;
    arc.style.strokeDasharray = `${(p * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`;
    // at 0 the round cap would stay at the top as a dot
    arc.style.opacity = p ? 1 : 0;
    const a = (v >= 3600 ? (v % 3600) / 3600 : p) * 2 * Math.PI;
    knob.setAttribute('transform', `translate(${(260 + 218 * Math.sin(a)).toFixed(1)} ${(260 - 218 * Math.cos(a)).toFixed(1)})`);
    big.textContent = clock(v);
    big.classList.toggle('is-long', v >= 3600);
    sub.textContent = r.ring ? t('done') : drag ? t(run ? 'drop_restart' : 'drop_start')
      : r.st === 'active' ? t('done_at', hhmm(r.end)) : r.st === 'paused' ? t('paused_tap') : t('tap_start');
    dial.setAttribute('aria-valuenow', v);
    dial.setAttribute('aria-valuetext', clock(v));
    w.classList.toggle('is-ring', r.ring);
    w.classList.toggle('is-run', r.st === 'active' && !r.ring);
    w.classList.toggle('is-paused', r.st === 'paused' && !r.ring);
    // sound here: every 6 s while it rings, like on the speakers
    if (r.ring && !lastRing) ringHere();
    lastRing = r.ring;
    // the right side only redraws on changes (touches would get lost otherwise)
    const here = ls(LS.here) !== false;
    const key = JSON.stringify([r.st, r.ring, r.sound, r.box, here]);
    if (key === lastSide) return;
    lastSide = key;
    const acts = r.ring
      ? `<button class="dv-btn tm-stop" data-a="stop">${icon('mdi:bell-off')}${esc(t('stop'))}</button>
         <button class="dv-btn" data-a="snooze">${icon('mdi:timer-plus-outline')}${esc(t('snooze'))}</button>`
      : run
        ? `<button class="dv-btn dv-btn--ink" data-a="${r.st === 'active' ? 'pause' : 'resume'}">${icon(r.st === 'active' ? 'mdi:pause' : 'mdi:play')}${esc(t(r.st === 'active' ? 'pause' : 'resume'))}</button>
           <button class="dv-btn" data-a="stop">${icon('mdi:stop')}${esc(t('stop'))}</button>
           <button class="dv-btn" data-a="add" data-s="60">${esc(t('add_min', 1))}</button>
           <button class="dv-btn" data-a="add" data-s="300">${esc(t('add_min', 5))}</button>`
        : `<button class="dv-btn dv-btn--ink tm-go" data-a="go">${icon('mdi:play')}${esc(t('start'))}</button>`;
    side.innerHTML = `<div class="tm-acts">${acts}</div>
      <div class="dv-sec"><span class="label">${esc(t('quick'))}</span><div class="tm-presets">
        ${PRESETS.map((x) => `<button class="tm-pre" data-a="pre" data-s="${x.min * 60}"><i aria-hidden="true">${esc(x.icon || '')}</i><span>${esc(x.name)}</span><b class="num">${x.min}<small> ${esc(t('min'))}</small></b></button>`).join('')}
      </div></div>
      <div class="dv-sec"><span class="label">${esc(t('sound'))}</span><div class="tm-ton">
        <select aria-label="${esc(t('sound'))}">${SOUNDS.map((k) => `<option value="${k}"${k === r.sound ? ' selected' : ''}>${esc(t(`sound_${k}`))}</option>`).join('')}</select>
        <button class="tm-chip" data-a="hear">${icon('mdi:play')}${esc(t('listen'))}</button>
      </div></div>
      <div class="dv-sec"><span class="label">${esc(t(SPEAKERS.length ? 'rings_on_speakers' : 'rings_on'))}</span><div class="tm-chips tm-chips--row">
        ${SPEAKERS.map((s) => `<button class="tm-chip${r.box.includes(s.entity) ? ' is-on' : ''}" data-a="box" data-k="${esc(s.entity)}">${icon('mdi:speaker')}${esc(s.name)}</button>`).join('')}
        <button class="tm-chip${here ? ' is-on' : ''}" data-a="here">${icon('mdi:tablet')}${esc(t('this_device'))}</button>
      </div></div>`;
  };

  let ringT = null;
  const ringHere = () => {
    clearTimeout(ringT);
    const go = () => {
      const r = read();
      if (!r.ring || !ui) return;
      if (ls(LS.here) !== false) play(r.sound);
      ringT = setTimeout(go, 6000);
    };
    go();
  };

  // Turning the ring: angle from 12 o'clock; jumps across 12 are resolved so several turns work
  const ang = (e) => {
    const b = dial.getBoundingClientRect(), x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2;
    return { a: (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360, d: Math.hypot(x, y) / (b.width / 2) };
  };
  // 30 s steps up to 10 min, whole minutes above
  const snap = (s) => (s < 600 ? Math.round(s / 30) * 30 : Math.round(s / 60) * 60);
  dial.addEventListener('pointerdown', (e) => {
    const g = ang(e);
    if (g.d < 0.62 || g.d > 1.05) return;
    const r = read(), run = r.st === 'active' || r.st === 'paused';
    const v = r.ring ? 0 : run ? r.left : sel;
    // a tap puts the ring at that spot (within the current hour), dragging turns on from there
    const raw = Math.floor(v / 3600) * 3600 + g.a * 10;
    drag = { prev: g.a, raw, v: Math.max(0, Math.min(MAX, snap(raw))), run, v0: v, moved: 0 };
    try { dial.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    e.preventDefault();
    draw();
  });
  dial.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const g = ang(e);
    let d = g.a - drag.prev;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    drag.prev = g.a;
    drag.moved += Math.abs(d);
    drag.raw = Math.max(0, Math.min(MAX, drag.raw + d * 10));
    drag.v = snap(drag.raw);
    draw();
  });
  const drop = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    // running timer: only turning changes it, an accidental tap on the ring does not
    if (d.run && d.moved < 4) { draw(); return; }
    if (d.v > 0) { sel = d.v; ls(LS.last, d.v); }
    if (d.run && d.v > 0) start(d.v);
    draw();
  };
  dial.addEventListener('pointerup', drop);
  dial.addEventListener('pointercancel', drop);

  w.addEventListener('pointerdown', () => { unlock(); poke(); });
  w.addEventListener('pointerup', (e) => {
    if (drag) return;
    if (e.target === w || e.target.closest('[data-a="close"]')) { close(); return; }
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const r = read(), act = b.dataset.a;
    if (act === 'core') doAct(r.ring ? 'stop' : r.st === 'active' ? 'pause' : r.st === 'paused' ? 'resume' : 'go', r);
    else doAct(act, r, +b.dataset.s, b.dataset.k);
  });
  const doAct = (act, r, s, k) => {
    if (act === 'go') start(sel);
    else if (act === 'pre') start(s);
    else if (act === 'pause') call('timer', 'pause', { entity_id: T });
    else if (act === 'resume') call('timer', 'start', { entity_id: T });
    else if (act === 'stop') { stop(); if (playing) try { playing.stop(); } catch (e) { /* already over */ } }
    else if (act === 'snooze') start(60);
    // timer.change cannot go past the starting duration -> restart with the new duration
    else if (act === 'add') {
      const d = dur(Math.min(MAX, r.left + s));
      if (r.st === 'paused') call('timer', 'start', { entity_id: T, duration: d }).then(() => call('timer', 'pause', { entity_id: T }));
      else call('timer', 'start', { entity_id: T, duration: d });
    } else if (act === 'hear') play(r.sound);
    else if (act === 'box') {
      const box = r.box.includes(k) ? r.box.filter((x) => x !== k) : [...r.box, k];
      call('input_text', 'set_value', { entity_id: BOX, value: box.join(',') });
    } else if (act === 'here') { ls(LS.here, ls(LS.here) === false); draw(); }
    setTimeout(draw, 300);
  };

  // a sound from the list: save it and play it right away
  side.addEventListener('change', (e) => {
    if (e.target.tagName !== 'SELECT') return;
    unlock();
    call('input_select', 'select_option', { entity_id: SOUND, option: e.target.value });
    play(e.target.value);
  });

  const tick = setInterval(draw, 250);
  draw();
  poke();
  ui = { close, draw };
  return ui;
};

window.__frameTimer = () => { unlock(); open(); };

// ---------- Floating bar, bottom right, while the timer runs, is paused or rings and the window is closed.
// Tap it to open the window; pause/resume and stop right there. Drag it elsewhere; the spot is kept per device
// (0–1 of the free space).
const mini = document.createElement('div');
mini.id = 'frame-timer-mini';
mini.style.cssText = 'position:relative;z-index:15;';
const mroot = mini.attachShadow({ mode: 'open' });
if (window.__frameStyle) window.__frameStyle(mroot);
mroot.innerHTML = '<div id="m"></div>';
document.body.appendChild(mini);
const mbox = mroot.getElementById('m');
let mkey = '';
const RC = 2 * Math.PI * 21, GAP = 12;
const place = (el) => {
  const pos = ls(LS.pos);
  if (!pos || !(pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1)) return;
  const b = el.getBoundingClientRect();
  Object.assign(el.style, { right: 'auto', bottom: 'auto',
    left: `${GAP + pos.x * Math.max(0, innerWidth - 2 * GAP - b.width)}px`, top: `${GAP + pos.y * Math.max(0, innerHeight - 2 * GAP - b.height)}px` });
};
window.addEventListener('resize', () => { const el = mbox.querySelector('.tmm'); if (el) place(el); });
// the bar is rebuilt only when the state changes (touches would get lost otherwise), time and ring every half second
const drawMini = () => {
  const r = hass() && read();
  const on = r && onFrame() && !ui && (r.ring || r.st === 'active' || r.st === 'paused');
  const key = on ? `${r.ring}|${r.st}` : '';
  if (key !== mkey) {
    mkey = key;
    mbox.innerHTML = !on ? '' : `<div class="tmm${r.ring ? ' is-ring' : r.st === 'paused' ? ' is-paused' : ''}">
        <div class="tmm-ring" data-a="open"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="21"/>
          <circle class="tmm-arc" cx="26" cy="26" r="21" transform="rotate(-90 26 26)"/></svg>
          ${icon(r.ring ? 'mdi:bell-ring' : 'mdi:timer-outline')}</div>
        <div class="tmm-main" data-a="open"><b class="num"></b><span></span></div>
        ${r.ring ? `<button class="tmm-b is-big" data-a="stop" aria-label="${esc(t('stop'))}">${icon('mdi:bell-off')}</button>`
          : `<button class="tmm-b" data-a="${r.st === 'active' ? 'pause' : 'resume'}" aria-label="${esc(t(r.st === 'active' ? 'pause' : 'resume'))}">${icon(r.st === 'active' ? 'mdi:pause' : 'mdi:play')}</button>
             <button class="tmm-b" data-a="stop" aria-label="${esc(t('stop'))}">${icon('mdi:stop')}</button>`}
      </div>`;
  }
  if (!on) return;
  const el = mbox.querySelector('.tmm');
  if (!el.__placed) { el.__placed = true; requestAnimationFrame(() => place(el)); }
  const p = r.ring ? 1 : r.total ? Math.max(0, Math.min(1, r.left / r.total)) : 0;
  mbox.querySelector('.tmm-arc').style.strokeDasharray = `${(p * RC).toFixed(1)} ${RC.toFixed(1)}`;
  mbox.querySelector('.tmm-main b').textContent = r.ring ? t('done') : clock(r.left);
  mbox.querySelector('.tmm-main span').textContent = r.ring ? t('ringing') : r.st === 'paused' ? t('paused') : t('done_at', hhmm(r.end));
};
// dragging from 8 px; the release after a drag is caught in the capture phase so no button fires
mroot.addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest('.tmm');
  if (!el || ev.button > 0) return;
  const r = el.getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY;
  let on = false, l = r.left, tp = r.top;
  const move = (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!on) {
      if (Math.hypot(dx, dy) < 8) return;
      on = true;
      el.classList.add('is-drag');
      try { el.setPointerCapture(ev.pointerId); } catch (x) { /* already released */ }
    }
    e.preventDefault();
    l = Math.min(Math.max(GAP, r.left + dx), innerWidth - GAP - r.width);
    tp = Math.min(Math.max(GAP, r.top + dy), innerHeight - GAP - r.height);
    Object.assign(el.style, { left: `${l}px`, top: `${tp}px`, right: 'auto', bottom: 'auto' });
  };
  const up = (e) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', up, true);
    if (!on) return;
    e.stopPropagation();
    el.classList.remove('is-drag');
    const fw = innerWidth - 2 * GAP - r.width, fh = innerHeight - 2 * GAP - r.height;
    const c = (v) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
    ls(LS.pos, { x: fw > 0 ? c((l - GAP) / fw) : 1, y: fh > 0 ? c((tp - GAP) / fh) : 1 });
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
});
mroot.addEventListener('pointerup', (e) => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  unlock();
  const a = b.dataset.a;
  if (a === 'open') open();
  else if (a === 'pause') call('timer', 'pause', { entity_id: T });
  else if (a === 'resume') call('timer', 'start', { entity_id: T });
  else if (a === 'stop') { call('input_boolean', 'turn_off', { entity_id: RING }); call('timer', 'cancel', { entity_id: T }); }
  setTimeout(drawMini, 300);
});
setInterval(drawMini, 500);

// Done: open the window on every device showing Frame (once per ring; closed stays closed)
let rung = false;
setInterval(() => {
  const h = hass();
  const ring = !!(h && h.states[RING] && h.states[RING].state === 'on');
  if (ring && !rung && onFrame()) open();
  rung = ring;
}, 1000);
