// Ask (frame_rail): Home Assistant's Assist dialog in Frame style, big enough to read from across the room.
// Loaded by frame.js when `ask:` is set in the household settings. The rail gets an "Ask" button that opens Assist
// with your pipeline; questions and answers stay on the device for 24 hours; with `speaker:` each answer is also
// read out there (the wall tablet can't play it in the dialog without a touch).
//
// Home Assistant loads the dialog on first use and rebuilds parts of it every time it opens, so after show-dialog
// the rules go into each shadow root (!important: HA's own rules are in adoptedStyleSheets). Outside Frame the
// dialog is left as it is.
const C = window.__frameAskConfig || {};
const T = Object.assign({ ask: 'Ask' }, C.text || {});
const ha = document.querySelector('home-assistant');
const onFrame = () => location.pathname.split('/')[1] === C.dashboard;
const css = (s) => s.replace(/\s+/g, ' ');

const CSS = {
  dialog: css(`ha-dialog { --primary-color: #111111 !important; --text-primary-color: #F2EEE6 !important;
      --primary-text-color: #111111 !important; --secondary-text-color: #7A756B !important;
      --secondary-background-color: #F2EEE6 !important; --ha-color-form-background: #F2EEE6 !important;
      --ha-dialog-surface-background: #FBF9F4 !important; --dialog-box-shadow: 0 24px 60px rgb(17 17 17 / .25) !important; }
    @media (min-width: 768px) {
      ha-dialog { --ha-dialog-width-md: 1040px !important; --ha-dialog-border-radius: 28px !important;
        --ha-dialog-min-height: calc(100vh - 96px) !important; --ha-dialog-max-height: calc(100vh - 96px) !important; } }
    div[slot="title"] { font-size: 0 !important; margin: 0 !important; gap: 10px; }
    div[slot="title"]::before { content: ${JSON.stringify(T.ask)}; font: 400 56px/1 'Instrument Serif', Georgia, serif; color: #111111; }
    ha-dropdown { margin: 0 !important; font-size: 15px; }
    ha-dropdown ha-button::part(base) { font: 800 15px/1 'Archivo', system-ui, sans-serif !important; letter-spacing: .08em !important;
      text-transform: uppercase !important; color: #7A756B !important; margin-left: 0 !important; }
    ha-icon-button[slot="actionItems"] { display: none !important; }
    ha-icon-button[slot="navigationIcon"] { width: 56px; height: 56px; display: grid; place-items: center; border-radius: 50%;
      background: #E8E2D5; color: #111111; --mdc-icon-size: 28px; }`),
  // close on the right, like Frame's other windows
  header: css(`.header-bar { padding: 28px 28px 8px 40px !important; align-items: flex-start !important; }
    .header-navigation-icon { order: 2; }
    .header-content { padding: 0 !important; }
    .header-title { height: auto !important; overflow: visible !important; }`),
  // question and answer the same size; bubbles as wide as their text (80 % at most), question right, answer left
  chat: css(`.messages { padding: 8px 40px 16px !important; }
    .message { font: 400 30px/1.35 'Archivo', system-ui, sans-serif !important; padding: 18px 24px !important; border-radius: 24px !important;
      margin: 8px 0 !important; margin-inline: 0 !important; }
    .message-container { max-width: 80% !important; }
    .message.hass { border-bottom-left-radius: 6px !important; }
    .message.user { border-bottom-right-radius: 6px !important; }
    .input { padding: 8px 40px 36px !important; }
    .listening-icon { display: flex; align-items: center; height: 100%; }
    .listening-icon ha-icon-button { width: 60px; height: 60px; display: grid; place-items: center; border-radius: 50%;
      background: #111111; color: #F2EEE6; --mdc-icon-size: 30px; position: relative; z-index: 1; transition: background .2s, color .2s; }
    .bouncer { display: none !important; }
    .input[data-frame-state="rec"] .listening-icon ha-icon-button { background: #E5261E; color: #FFFFFF; animation: frame-pulse 1.4s ease-out infinite; }
    .input[data-frame-state="think"] .listening-icon ha-icon-button { background: #E8E2D5; color: #7A756B; }
    @keyframes frame-pulse { from { box-shadow: 0 0 0 0 rgb(229 38 30 / .5); } to { box-shadow: 0 0 0 18px rgb(229 38 30 / 0); } }
    @media (max-width: 767px) {
      .messages { padding: 4px 16px 12px !important; } .input { padding: 8px 16px 20px !important; }
      .message { font-size: 22px !important; padding: 12px 16px !important; } }`),
  // the label as a placeholder in the middle of the field, gone once you type
  input: css(`wa-input::part(base) { border-radius: 18px !important; height: 80px !important; padding: 0 10px 0 24px !important; }
    :host([appearance="material"]) ::part(base)::after { height: 0 !important; }
    wa-input::part(input) { font: 400 26px/1.2 'Archivo', system-ui, sans-serif !important; padding-top: 0 !important; }
    wa-input::part(label), :host(:focus-within) wa-input::part(label) { font-size: 24px !important; line-height: 80px !important;
      padding: 0 0 0 24px !important; top: 0 !important; color: #7A756B !important; }
    wa-input.label-raised::part(label) { display: none !important; }
    @media (max-width: 767px) {
      wa-input::part(base) { height: 64px !important; } wa-input::part(input) { font-size: 20px !important; }
      wa-input::part(label), :host(:focus-within) wa-input::part(label) { font-size: 19px !important; line-height: 64px !important; } }`),
};

// The chat per device, 24 h from each message
const HIST = {
  key: 'frame-assist-chat',
  keep: 24 * 3600e3,
  load(s = '') { try { return JSON.parse(localStorage.getItem(this.key + s)) || (s ? null : []); } catch (e) { return s ? null : []; } },
  save(v, s = '') { try { localStorage.setItem(this.key + s, JSON.stringify(v)); } catch (e) { /* private mode or full: no history */ } },
};
const put = (root, text) => {
  if (!root) return;
  let x = root.getElementById('frame-assist');
  if (!x) { x = document.createElement('style'); x.id = 'frame-assist'; root.appendChild(x); }
  if (x.textContent !== text) x.textContent = text;
};

// Frame is showing: a class on <home-assistant> that the rules below and the Companion app patch look at
const route = () => ha.classList.toggle('frame-active', onFrame());
window.addEventListener('location-changed', route);
window.addEventListener('popstate', route);
route();
// hidden until it's styled, otherwise HA's small dialog flashes up first
put(ha.shadowRoot, ':host(.frame-active) > ha-voice-command-dialog:not([data-frame-ready]) { visibility: hidden; }');

const fix = () => {
  const d = ha.shadowRoot.querySelector('ha-voice-command-dialog');
  if (!d || !d.shadowRoot) return;
  const on = ha.classList.contains('frame-active');
  const sr = d.shadowRoot, chat = sr.querySelector('ha-assist-chat'), hdr = sr.querySelector('ha-dialog-header');
  const inp = chat && chat.shadowRoot && chat.shadowRoot.querySelector('ha-input');
  put(sr, on ? CSS.dialog : '');
  put(hdr && hdr.shadowRoot, on ? CSS.header : '');
  put(chat && chat.shadowRoot, on ? CSS.chat : '');
  put(inp && inp.shadowRoot, on ? CSS.input : '');
  if (chat && chat.shadowRoot) d.setAttribute('data-frame-ready', '');
  // flexcontent: otherwise the chat is only 400 px high and doesn't scroll
  const hd = sr.querySelector('ha-dialog');
  if (hd && on) hd.setAttribute('flexcontent', '');
  if (!chat || chat.__frameHook) return;
  // After every redraw of the chat: state for the CSS, history, scroll to the last question, read the answer out
  chat.__frameHook = true;
  const said = new WeakSet();
  const up = chat.updated;
  chat.updated = function (ch) {
    if (up) up.call(this, ch);
    const row = this.shadowRoot && this.shadowRoot.querySelector('.input');
    if (!ha.classList.contains('frame-active')) { if (row) row.removeAttribute('data-frame-state'); return; }
    const conv = this._conversation || [];
    const m = conv[conv.length - 1];
    const text = String((m && m.text) || '').trim();
    // streaming: HA updates the same message and ends it with "…" until it's done
    const waiting = conv.length > 1 && m && m.who === 'hass' && !m.error && (!text || text.endsWith('…'));
    const state = this._audioRecorder && this._audioRecorder.active ? 'rec' : waiting ? 'think' : '';
    if (row) { if (state) row.setAttribute('data-frame-state', state); else row.removeAttribute('data-frame-state'); }
    // History: on opening, HA resets the chat to its greeting; in the first seconds the stored questions and answers
    // go in front of it. HA sometimes loads the greeting late and overwrites them, then they go in again.
    const now = Date.now();
    const stored = HIST.load().filter((x) => now - x.ts < HIST.keep);
    if (now - (window.__frameAssistOpened || 0) < 4000 && conv.length === 1 && conv[0].who === 'hass' && stored.length) {
      this._conversation = stored.map((x) => ({ who: x.who, text: x.text, thinking: '', tool_calls: {}, __ts: x.ts, __old: true })).concat(conv);
      // the agent only remembers the context while HA keeps the conversation (5 min without a question)
      const cid = HIST.load('-cid');
      if (cid && cid.id && now - cid.ts < 5 * 60e3) this._conversationId = cid.id;
      return;
    }
    // store questions and the answer right after them (no greeting, no errors)
    if (!waiting && conv.some((x) => x.who === 'user')) {
      const keep = [];
      conv.forEach((x, i) => {
        if (x.error || !x.text || (x.who !== 'user' && !(conv[i - 1] && conv[i - 1].who === 'user'))) return;
        x.__ts = x.__ts || now;
        keep.push({ who: x.who, text: String(x.text), ts: x.__ts });
      });
      HIST.save(keep.filter((x) => now - x.ts < HIST.keep));
      if (this._conversationId) HIST.save({ id: this._conversationId, ts: now }, '-cid');
    }
    // the last question to the top, the start of the answer below it (markdown renders a little later)
    setTimeout(() => {
      const box = this.shadowRoot && this.shadowRoot.querySelector('.messages');
      const qs = box && box.querySelectorAll('.message-container.user');
      const q = qs && qs[qs.length - 1];
      const key = conv.length + ':' + text.length;
      if (!q || box.__frameKey === key) return;
      box.__frameKey = key;
      box.scrollTop += q.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
    }, 150);
    // A finished answer -> announcement on the speaker (music dips and carries on). Only a new answer to a question,
    // not the greeting or anything from the stored history, and only from the Ask pipeline.
    const prev = conv[conv.length - 2];
    if (!C.speaker || !prev || prev.who !== 'user' || !m || m.who !== 'hass' || m.error || m.__old || waiting || said.has(m)) return;
    if (C.pipeline && d._pipelineId !== C.pipeline) return;
    said.add(m);
    const q = new URLSearchParams({ message: text });
    if (C.language) q.set('language', C.language);
    if (C.voice) q.set('voice', C.voice);
    ha.hass.callService('media_player', 'play_media', {
      entity_id: C.speaker,
      media_content_id: `media-source://tts/${C.tts || 'tts.home_assistant_cloud'}?${q}`,
      media_content_type: 'music',
      announce: true,
      // Sonos takes the announcement volume as 0–100; other players ignore it
      ...(C.volume != null ? { extra: { volume: C.volume } } : {}),
    }).catch((e) => console.error('Frame: could not read the answer out', e));
  };
};

ha.addEventListener('show-dialog', (ev) => {
  if (ev && ev.detail && ev.detail.dialogTag !== 'ha-voice-command-dialog') return;
  window.__frameAssistOpened = Date.now();
  // until it's styled, check every frame (1.5 s at most, then show it anyway), then a few more times for parts HA rebuilds
  const d0 = ha.shadowRoot.querySelector('ha-voice-command-dialog');
  if (d0) d0.removeAttribute('data-frame-ready');
  const t0 = Date.now();
  const poll = () => {
    fix();
    const d = ha.shadowRoot.querySelector('ha-voice-command-dialog');
    if (d && d.hasAttribute('data-frame-ready')) return;
    if (Date.now() - t0 > 1500) { if (d) d.setAttribute('data-frame-ready', ''); return; }
    requestAnimationFrame(poll);
  };
  poll();
  [250, 600, 1200].forEach((t) => setTimeout(fix, t));
});

// Companion app: with hasAssist, HA sends assist/show to the app instead of opening the dialog, and the app opens its
// native Assist view (no read-out, history or Frame style). On Frame hasAssist reports false; elsewhere it stays native.
const ext = ha.hass && ha.hass.auth && ha.hass.auth.external;
if (ext && !ext.__frameAssist) {
  ext.__frameAssist = true;
  const patch = (c) => {
    if (!c || typeof c !== 'object' || c.__frameAssist) return c;
    let v = c.hasAssist;
    Object.defineProperty(c, 'hasAssist', { configurable: true, enumerable: true,
      get: () => v && !ha.classList.contains('frame-active'), set: (n) => { v = n; } });
    Object.defineProperty(c, '__frameAssist', { value: true });
    return c;
  };
  let cfg = patch(ext.config);
  Object.defineProperty(ext, 'config', { configurable: true, enumerable: true, get: () => cfg, set: (c) => { cfg = patch(c); } });
}

// Safari/iOS: HA creates the microphone's AudioContext only once the dialog has loaded, no longer inside the touch.
// The context then stays suspended, no sound arrives and speech-to-text gives up after 10 s. So start a context
// when Ask is tapped and hand it to HA at its next new AudioContext() (without options).
const AC = window.AudioContext || window.webkitAudioContext;
if (AC && !AC.__frame) {
  const Pre = function (...args) {
    const c = window.__frameAudioCtx;
    window.__frameAudioCtx = null;
    if (c && c.state !== 'closed' && !args.length) return c;
    return new AC(...args);
  };
  Pre.prototype = AC.prototype;
  Pre.__frame = true;
  window.AudioContext = Pre;
}

// The rail's Ask button. pointerup/click: only then does a touch count as a user action (pointerdown only with a mouse).
window.__frameAsk = (el) => {
  try {
    const c = window.__frameAudioCtx && window.__frameAudioCtx.state !== 'closed' ? window.__frameAudioCtx : new AC();
    c.resume();
    window.__frameAudioCtx = c;
  } catch (err) { /* no warm-up then */ }
  // the same as a card's `tap_action: assist`
  el.dispatchEvent(new CustomEvent('hass-action', { bubbles: true, composed: true, detail: {
    action: 'tap',
    config: { tap_action: { action: 'assist', pipeline_id: C.pipeline || 'last_used', start_listening: C.start_listening !== false } },
  } }));
};
