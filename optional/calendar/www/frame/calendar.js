// Frame calendar: everything you can do on the calendar page (optional/calendar). Loaded once by the
// frame_calendar template; the template draws the grid, this file handles the taps:
//   tap an empty spot     -> new event (day and time filled in)
//   tap an event          -> details with Edit and Delete
//   hold an event, drag   -> move it (15-minute steps, other days, into or out of the all-day row)
//   swipe / scroll sideways -> previous / next page
// Changes go through Home Assistant's calendar API. Editing is "create the new one, delete the old one",
// because many calendars (Google, CalDAV) can create and delete through Home Assistant but not update.
// Every change is written to the logbook and can be undone for 10 seconds.
const UI = window.__frameCalUI || (window.__frameCalUI = {});

// Words on this page. Override any of them with `text` in templates/frame.yaml, like the core strings.
const TEXT = {
  cal_new: 'New event', cal_edit: 'Edit event', cal_what: 'What’s happening?', cal_for: 'For', cal_when: 'When', cal_time: 'Time',
  cal_dur: 'Length', cal_where: 'Where', cal_note: 'Note', cal_optional: 'optional', cal_to: 'to', cal_all_day: 'All day',
  cal_cancel: 'Cancel', cal_save: 'Save', cal_close: 'Close', cal_delete: 'Delete', cal_edit_btn: 'Edit',
  cal_sure: 'Really delete', cal_series: 'Delete whole series', cal_only_this: 'Only this one', cal_all_following: 'This and all following',
  cal_never: 'Never', cal_daily: 'Daily', cal_weekly: 'Weekly', cal_monthly: 'Monthly', cal_yearly: 'Yearly', cal_repeats: 'Repeats',
  cal_scope_same: 'Changes apply to this one event only.', cal_scope_none: 'No more repeats from here: this event stays, all following ones go.',
  cal_scope_new: 'New repeat from this event on, for it and all following ones.',
  cal_need_title: 'Please enter a title.', cal_need_when: 'Please pick a calendar, a day and a time.', cal_same: 'Start and end are the same.',
  cal_before: 'The end is before the start.', cal_readonly: 'This calendar can’t be changed here.', cal_tentative: 'Tentative, not confirmed yet',
  cal_created: '{0} added', cal_saved: '{0} saved', cal_deleted: '{0} deleted', cal_moved: '{0} → {1}', cal_undo: 'Undo', cal_undone: 'Undone',
  cal_failed: 'That didn’t work: {0}', cal_partial: 'The new event is there, but the old one couldn’t be deleted ({0})', cal_gone: 'Event not found any more',
  cal_min: '{0} min', cal_hours: '{0} h',
};

const REPEAT = '<svg class="lu" viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>';

// ctx from the template on every render: {fx, hass, root, reload, calendars, text, go(step)}
UI.init = (ctx) => {
  Object.assign(UI, ctx);
  UI.evs = UI.evs || [];
};
const t = (k, ...a) => String((UI.text || {})[k] != null ? UI.text[k] : TEXT[k] != null ? TEXT[k] : k).replace(/\{(\d)\}/g, (_, i) => (a[i] == null ? '' : a[i]));
const fx = () => UI.fx;
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const longDay = (d) => d.toLocaleDateString(fx().lang, { weekday: 'long', day: 'numeric', month: 'long' });
const stamp = (d, allDay) => `${d.toLocaleDateString(fx().lang, { weekday: 'short', day: 'numeric', month: 'numeric' })}${allDay ? '' : ' ' + fx().time(d)}`;
const writable = () => (UI.calendars || []).filter((c) => !c.readonly);
const calName = (entity) => { const c = (UI.calendars || []).find((x) => x.entity === entity); return c ? fx().person(c.who).name : entity; };

// Repeat rule (RRULE) in words, e.g. "Weekly on Monday and Wednesday, until 31/12/2026"
const ruleText = (rule) => {
  if (!rule) return '';
  const r = {};
  String(rule).replace(/^RRULE:/, '').split(';').forEach((kv) => { const [k, v] = kv.split('='); r[k] = v; });
  const n = Number(r.INTERVAL || 1);
  const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const dayName = (i) => new Date(2024, 0, 7 + i).toLocaleDateString(fx().lang, { weekday: 'long' });
  const days = (r.BYDAY || '').split(',').filter(Boolean).map((d) => { const m = d.match(/^(-?\d+)?([A-Z]{2})$/); return m ? `${m[1] ? m[1] + ' ' : ''}${dayName(WD[m[2]])}` : d; });
  let s = { DAILY: n > 1 ? `Every ${n} days` : t('cal_daily'), WEEKLY: n > 1 ? `Every ${n} weeks` : t('cal_weekly'),
    MONTHLY: n > 1 ? `Every ${n} months` : t('cal_monthly'), YEARLY: n > 1 ? `Every ${n} years` : t('cal_yearly') }[r.FREQ] || t('cal_repeats');
  if (days.length) s += ` · ${days.join(', ')}`;
  if (r.UNTIL) s += ` · ${t('cal_to')} ${new Date(+r.UNTIL.slice(0, 4), +r.UNTIL.slice(4, 6) - 1, +r.UNTIL.slice(6, 8)).toLocaleDateString(fx().lang)}`;
  if (r.COUNT) s += ` · ${r.COUNT}×`;
  return s;
};

// ------------------------------------------------------------ talking to Home Assistant
const offs = (d) => { const o = -d.getTimezoneOffset(); return `${o < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(o) / 60))}:${pad(Math.abs(o) % 60)}`; };
const local = (d) => `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
// ev: {summary, from, to, allDay, loc, desc, rrule}. With a repeat rule over the WebSocket (the action has no rrule).
UI.add = (cal, ev) => {
  if (ev.rrule) {
    const event = { summary: ev.summary, rrule: ev.rrule,
      dtstart: ev.allDay ? isoDay(ev.from) : local(ev.from) + offs(ev.from), dtend: ev.allDay ? isoDay(ev.to) : local(ev.to) + offs(ev.to) };
    if (ev.loc) event.location = ev.loc;
    if (ev.desc) event.description = ev.desc;
    return UI.hass.callWS({ type: 'calendar/event/create', entity_id: cal, event });
  }
  const data = { summary: ev.summary };
  if (ev.loc) data.location = ev.loc;
  if (ev.desc) data.description = ev.desc;
  if (ev.allDay) { data.start_date = isoDay(ev.from); data.end_date = isoDay(ev.to); }
  else { data.start_date_time = local(ev.from).replace('T', ' '); data.end_date_time = local(ev.to).replace('T', ' '); }
  return UI.hass.callService('calendar', 'create_event', data, { entity_id: cal });
};
const del = (e, range) => UI.hass.callWS(Object.assign({ type: 'calendar/event/delete', entity_id: e.cal, uid: e.uid },
  e.rid ? { recurrence_id: e.rid } : {}, e.rid && range ? { recurrence_range: range } : {}));
// Replace = create the new event, then delete the old one. If only the delete fails: rejected with {partial: true}.
UI.replace = (orig, cal, ev, range) => UI.add(cal, ev).then(() => del(orig, range).catch((err) => Promise.reject({ partial: true, err })));
// Find a freshly created event again (the action returns no uid)
UI.find = (cal, ev) => UI.hass.callApi('GET', `calendars/${cal}?start=${encodeURIComponent(new Date(ev.from.getTime() - 60000).toISOString())}&end=${encodeURIComponent(new Date(ev.to.getTime() + 60000).toISOString())}`)
  .then((list) => {
    const hit = list.find((x) => x.summary === ev.summary && x.uid
      && (ev.allDay ? x.start.date === isoDay(ev.from) : new Date(x.start.dateTime).getTime() === ev.from.getTime()));
    return hit ? { cal, uid: hit.uid, rid: hit.recurrence_id || null } : Promise.reject(t('cal_gone'));
  });
UI.log = (cal, message) => UI.hass.callService('logbook', 'log', { name: 'Frame calendar', message, entity_id: cal }).catch(() => {});
const asEv = (e) => ({ summary: e.title, from: e.from, to: e.to, allDay: e.all_day, loc: e.loc, desc: e.desc });
const errText = (err) => (err && err.partial ? t('cal_partial', (err.err && err.err.message) || err.err)
  : t('cal_failed', (err && (err.message || err.error || err.code)) || err));

// ------------------------------------------------------------ dialogs and toasts
UI.close = () => { if (UI.el) UI.el.remove(); UI.el = null; };
UI.open = (html) => {
  UI.close();
  if (!UI.root) return null;
  const w = document.createElement('div');
  w.className = 'ced-wrap';
  w.innerHTML = html;
  w.addEventListener('pointerup', (e) => { if (e.target === w) UI.close(); });
  UI.root.appendChild(w);
  UI.el = w;
  return w;
};
UI.toast = (text, bad, undo) => {
  if (!UI.root) return;
  UI.root.querySelectorAll('.ced-toast').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = `ced-toast${bad ? ' is-bad' : ''}`;
  el.textContent = text;
  if (undo) {
    const b = document.createElement('button');
    b.textContent = t('cal_undo');
    b.addEventListener('pointerup', () => {
      b.disabled = true;
      undo().then(() => { el.remove(); UI.toast(t('cal_undone')); UI.done(); }).catch((err) => { el.remove(); UI.toast(errText(err), true); });
    });
    el.appendChild(b);
  }
  UI.root.appendChild(el);
  setTimeout(() => el.remove(), bad ? 6000 : undo ? 10000 : 3000);
};
// after a change: drop the cache (also for frame_next and frame_agenda) and redraw
UI.done = () => { window.__frameCal = {}; UI.close(); if (UI.reload) UI.reload(); };
UI.fail = (w, err) => {
  if (err && err.partial) UI.done();
  w.querySelector('.ced-err').textContent = errText(err);
  w.querySelectorAll('button').forEach((b) => { b.disabled = false; });
};

// ------------------------------------------------------------ new / edit
UI.create = (start, allDay) => {
  if (!start) { start = new Date(); start.setHours(start.getHours() + 1, 0, 0, 0); }
  UI.edit({ start, allDay });
};
// o: {start, allDay, title?, cal?, loc?, desc?, mins?, days?, orig?}
UI.edit = (o) => {
  const F = fx(), start = o.start, allDay = !!o.allDay, orig = o.orig || null, cals = writable();
  if (!cals.length) return UI.toast(t('cal_readonly'), true);
  const cal0 = o.cal && cals.some((c) => c.entity === o.cal) ? o.cal : cals[0].entity;
  const chips = cals.map((c) => { const p = F.person(c.who);
    return `<button class="ced-chip${c.entity === cal0 ? ' is-on' : ''}" data-v="${c.entity}" style="${F.pstyle(p)}"><i></i>${F.esc(c.name || p.name)}</button>`; }).join('');
  const durs = [['30', t('cal_min', 30)], ['60', t('cal_hours', 1)], ['120', t('cal_hours', 2)], ['180', t('cal_hours', 3)], ['day', t('cal_all_day')]];
  const mins0 = allDay ? 60 : o.mins || 60;
  const dur0 = allDay ? 'day' : String(mins0);
  const end0 = F.day0(start, Math.max(1, allDay ? o.days || 1 : 1) - 1);
  const hm = (v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
  const hhmm = (n) => `${pad(Math.floor(n / 60) % 24)}:${pad(n % 60)}`;
  const span = (a, b) => (hm(b) - hm(a) + 1440) % 1440;
  const t0 = allDay ? 9 * 60 : start.getHours() * 60 + start.getMinutes();
  let longDays = Math.floor(mins0 / 1440) * 1440, curSpan = mins0 % 1440 || (longDays ? 0 : 60);
  // repeat: for one event of a series the current rule is preselected. Keeping it changes only this one;
  // changing it (also to "Never") applies to this and all following events.
  const series = !!(orig && orig.rid && orig.rrule);
  const reps = [['', t('cal_never')], ['FREQ=DAILY', t('cal_daily')], ['FREQ=WEEKLY', t('cal_weekly')], ['FREQ=MONTHLY', t('cal_monthly')], ['FREQ=YEARLY', t('cal_yearly')]];
  const rep0 = series ? orig.rrule : '';
  if (series && !reps.some(([v]) => v === rep0)) reps.push([rep0, ruleText(rep0)]);
  const scope = (v) => (!series ? '' : v === rep0 ? t('cal_scope_same') : v === '' ? t('cal_scope_none') : t('cal_scope_new'));
  const w = UI.open(`<div class="ced${allDay ? ' is-day' : ''}">
    <div class="ced-head"><b>${orig ? t('cal_edit') : t('cal_new')}</b></div>
    <input class="ced-title" placeholder="${t('cal_what')}" maxlength="120" enterkeyhint="done" autocomplete="off" value="${F.esc(o.title || '')}">
    <div class="ced-row"><span class="label">${t('cal_for')}</span><div class="ced-chips ced-who">${chips}</div></div>
    <div class="ced-row"><span class="label">${t('cal_when')}</span><div class="ced-when">
      <input type="date" class="ced-date" value="${isoDay(start)}"><span class="ced-bis">${t('cal_to')}</span><input type="date" class="ced-date2" min="${isoDay(start)}" value="${isoDay(end0)}"></div></div>
    <div class="ced-row ced-row--time"><span class="label">${t('cal_time')}</span><div class="ced-times">
      <input type="time" class="ced-time" value="${hhmm(t0)}"><span class="ced-bis">${t('cal_to')}</span><input type="time" class="ced-time2" value="${hhmm(t0 + curSpan)}"></div></div>
    <div class="ced-row"><span class="label">${t('cal_dur')}</span><div class="ced-chips ced-dur">${durs.map(([v, l]) =>
      `<button class="ced-chip${v === dur0 ? ' is-on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="ced-row"><span class="label">${t('cal_where')}</span><input class="ced-loc" placeholder="${t('cal_optional')}" autocomplete="off" value="${F.esc(o.loc || '')}"></div>
    <div class="ced-row ced-row--top"><span class="label">${t('cal_note')}</span><textarea class="ced-desc" rows="3" maxlength="2000" placeholder="${t('cal_optional')}">${F.esc(o.desc || '')}</textarea></div>
    <div class="ced-row"><span class="label ced-ico" title="${t('cal_repeats')}">${REPEAT}</span><div class="ced-chips ced-rep">${reps.map(([v, l]) =>
      `<button class="ced-chip${v === rep0 ? ' is-on' : ''}" data-v="${v}">${F.esc(l)}</button>`).join('')}</div></div>
    ${series ? `<div class="ced-note ced-scope">${scope(rep0)}</div>` : ''}
    <div class="ced-err"></div>
    <div class="ced-actions"><button class="ced-btn" data-a="cancel">${t('cal_cancel')}</button><button class="ced-btn ced-btn--ink" data-a="save">${t('cal_save')}</button></div>
  </div>`);
  if (!w) return;
  const q = (sel) => w.querySelector(sel);
  const pick = (group) => w.querySelectorAll(`${group} .ced-chip`).forEach((b) => b.addEventListener('pointerup', () => {
    w.querySelectorAll(`${group} .ced-chip`).forEach((x) => x.classList.toggle('is-on', x === b));
    if (group === '.ced-dur') {
      w.firstElementChild.classList.toggle('is-day', b.dataset.v === 'day');
      if (b.dataset.v !== 'day' && q('.ced-time').value) { curSpan = Number(b.dataset.v); longDays = 0; q('.ced-time2').value = hhmm(hm(q('.ced-time').value) + curSpan); }
    }
    if (group === '.ced-rep' && q('.ced-scope')) q('.ced-scope').textContent = scope(b.dataset.v);
  }));
  pick('.ced-who'); pick('.ced-dur'); pick('.ced-rep');
  // a new start time moves the end along (the length stays); an own end time picks the matching length
  q('.ced-time').addEventListener('change', () => { if (q('.ced-time').value) q('.ced-time2').value = hhmm(hm(q('.ced-time').value) + curSpan); });
  q('.ced-time2').addEventListener('change', () => {
    const a = q('.ced-time').value, b = q('.ced-time2').value;
    if (!a || !b) return;
    curSpan = span(a, b); longDays = 0;
    w.querySelectorAll('.ced-dur .ced-chip').forEach((x) => x.classList.toggle('is-on', x.dataset.v === String(curSpan)));
  });
  let prevDate = q('.ced-date').value;
  q('.ced-date').addEventListener('change', () => {
    const d = q('.ced-date').value, e2 = q('.ced-date2');
    if (!d) return;
    if (prevDate && e2.value) {
      const n = Math.round((new Date(`${e2.value}T12:00:00`) - new Date(`${prevDate}T12:00:00`)) / 864e5);
      e2.value = isoDay(F.day0(new Date(`${d}T00:00:00`), Math.max(0, n)));
    }
    e2.min = d;
    prevDate = d;
  });
  q('[data-a="cancel"]').addEventListener('pointerup', UI.close);
  q('[data-a="save"]').addEventListener('pointerup', () => {
    const title = q('.ced-title').value.trim();
    const who = (q('.ced-who .is-on') || {}).dataset, dur = (q('.ced-dur .is-on') || {}).dataset;
    const date = q('.ced-date').value, tm = q('.ced-time').value, tm2 = q('.ced-time2').value, date2 = q('.ced-date2').value || date;
    if (!title) { q('.ced-err').textContent = t('cal_need_title'); q('.ced-title').focus(); return; }
    const isDay = !!(dur && dur.v === 'day');
    if (!who || !date || (!isDay && (!tm || !tm2))) { q('.ced-err').textContent = t('cal_need_when'); return; }
    const mins = isDay ? 0 : span(tm, tm2) + longDays;
    if (!isDay && !mins) { q('.ced-err').textContent = t('cal_same'); return; }
    if (isDay && date2 < date) { q('.ced-err').textContent = t('cal_before'); return; }
    const loc = q('.ced-loc').value.trim(), desc = q('.ced-desc').value.trim();
    const repOn = q('.ced-rep .is-on'), rrule = repOn ? repOn.dataset.v : '';
    const repChanged = series && rrule !== rep0;
    const from = isDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${tm}:00`);
    const to = isDay ? F.day0(new Date(`${date2}T00:00:00`), 1) : new Date(from.getTime() + mins * 60000);
    if (orig && rrule === rep0 && title === orig.title && who.v === orig.cal && loc === (orig.loc || '') && desc === (orig.desc || '').trim()
      && isDay === orig.all_day && from.getTime() === orig.from.getTime() && to.getTime() === orig.to.getTime()) { UI.close(); return; }
    w.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    q('.ced-err').textContent = '';
    const ev = { summary: title, from, to, allDay: isDay, loc, desc, rrule: series && !repChanged ? '' : rrule };
    const cal = who.v;
    (orig ? UI.replace(orig, cal, ev, repChanged ? 'THISANDFUTURE' : null) : UI.add(cal, ev)).then(() => {
      UI.done();
      if (!orig) {
        UI.log(cal, `added: ${title} (${calName(cal)}) ${stamp(from, isDay)}`);
        UI.toast(t('cal_created', title), false, () => UI.find(cal, ev).then((f) => del(f)));
      } else {
        UI.log(cal, `changed: ${orig.title} (${calName(orig.cal)}) ${stamp(orig.from, orig.all_day)} → ${title} (${calName(cal)}) ${stamp(from, isDay)}`);
        const undo = !orig.rrule && !ev.rrule ? () => UI.find(cal, ev).then((f) => UI.replace(f, orig.cal, asEv(orig))) : null;
        UI.toast(t('cal_saved', title), false, undo);
      }
    }).catch((err) => UI.fail(w, err));
  });
  setTimeout(() => q('.ced-title').focus(), 50);
};

// ------------------------------------------------------------ details
UI.show = (e) => {
  const F = fx(), p = F.person(e.who);
  const canDelete = !e.readonly && e.uid && e.cal;
  const recurring = !!(e.rid || e.rrule);
  const canEdit = canDelete && (!recurring || !!e.rid);
  const when = e.all_day
    ? (F.day0(e.to, -1).getTime() > e.from.getTime() ? `${longDay(e.from)} – ${longDay(F.day0(e.to, -1))}` : `${longDay(e.from)} · ${t('cal_all_day')}`)
    : `${longDay(e.from)} · ${F.time(e.from)}–${F.time(e.to)}`;
  const w = UI.open(`<div class="ced ced--view" style="${F.pstyle(p)}">
    <span class="ced-cal"><i></i>${F.esc(p.name)}</span>
    <b class="ced-vtitle">${F.esc(e.title)}</b>
    <div class="ced-vwhen">${when}</div>
    ${e.loc ? `<div class="ced-vloc">${F.esc(e.loc)}</div>` : ''}
    ${recurring ? `<div class="ced-vrep">${REPEAT}${F.esc(ruleText(e.rrule) || t('cal_repeats'))}</div>` : ''}
    ${e.status === 'tentative' ? `<div class="ced-note">${t('cal_tentative')}</div>` : ''}
    ${e.desc ? `<div class="ced-vdesc">${F.esc(e.desc).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')}</div>` : ''}
    ${canDelete ? '' : `<div class="ced-note">${t('cal_readonly')}</div>`}
    <div class="ced-err"></div>
    <div class="ced-actions">${canDelete ? `<button class="ced-btn ced-btn--del" data-a="del">${t('cal_delete')}</button>` : ''}${canEdit ? `<button class="ced-btn" data-a="edit">${t('cal_edit_btn')}</button>` : ''}<button class="ced-btn ced-btn--ink" data-a="close">${t('cal_close')}</button></div>
  </div>`);
  if (!w) return;
  const q = (sel) => w.querySelector(sel);
  q('[data-a="close"]').addEventListener('pointerup', UI.close);
  if (canEdit) {
    q('[data-a="edit"]').addEventListener('pointerup', () => UI.edit({ start: e.from, allDay: e.all_day, title: e.title, cal: e.cal, loc: e.loc, desc: e.desc, orig: e,
      mins: Math.round((e.to - e.from) / 60000), days: Math.max(1, Math.round((F.day0(e.to) - F.day0(e.from)) / 864e5)) }));
  }
  if (!canDelete) return;
  const remove = (range) => {
    w.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    del(e, range).then(() => {
      UI.done();
      UI.log(e.cal, `deleted: ${e.title} (${calName(e.cal)}) ${stamp(e.from, e.all_day)}${range ? ' and all following' : ''}`);
      UI.toast(t('cal_deleted', e.title), false, recurring ? null : () => UI.add(e.cal, asEv(e)));
    }).catch((err) => UI.fail(w, err));
  };
  // ask first; for one event of a series: only this one or also all following
  q('[data-a="del"]').addEventListener('pointerup', () => {
    const acts = q('.ced-actions');
    acts.innerHTML = recurring && e.rid
      ? `<button class="ced-btn" data-a="back">${t('cal_cancel')}</button><button class="ced-btn ced-btn--del" data-a="one">${t('cal_only_this')}</button><button class="ced-btn ced-btn--del" data-a="all">${t('cal_all_following')}</button>`
      : `<button class="ced-btn" data-a="back">${t('cal_cancel')}</button><button class="ced-btn ced-btn--del is-sure" data-a="one">${recurring ? t('cal_series') : t('cal_sure')}</button>`;
    q('[data-a="back"]').addEventListener('pointerup', () => UI.show(e));
    q('[data-a="one"]').addEventListener('pointerup', () => remove(null));
    const all = q('[data-a="all"]');
    if (all) all.addEventListener('pointerup', () => remove('THISANDFUTURE'));
  });
};

// ------------------------------------------------------------ gestures
// Move by dragging (day/3 days/week): hold, then drag. Timed events snap to 15 minutes and move to other
// days; up into the all-day row makes them all-day. All-day events move sideways; down into the grid makes
// them 1 hour at that spot. Letting go saves (create new + delete old).
UI.drag = (ev, el) => {
  if (ev.button > 0) return;
  const F = fx(), e = UI.evs[Number(el.dataset.i)];
  let cols = UI.root ? [...UI.root.querySelectorAll('.cw-col')] : [];
  let body = UI.root && UI.root.querySelector('.cw-body');
  if (!e || !cols.length || !body) return;
  let cells = [...UI.root.querySelectorAll('.cw-adbg > div')].slice(1);
  const H0 = Number(cols[0].dataset.h0), hours = Number(cols[0].dataset.span);
  const x0 = ev.clientX, y0 = ev.clientY;
  const colAt = (x) => Math.max(0, cols.findIndex((c) => { const r = c.getBoundingClientRect(); return x >= r.left && x < r.right; }));
  const i0 = e.all_day ? colAt(x0) : Math.max(0, cols.indexOf(el.closest('.cw-col')));
  let label = el.querySelector('small');
  const label0 = label ? label.textContent : '', text0 = el.textContent;
  const pst = F.pstyle(F.person(e.who));
  const wd = (d) => d.toLocaleDateString(F.lang, { weekday: 'short' });
  let active = false, target = null, ghost = null, cell = null;
  UI.dragMoved = false;
  const timer = setTimeout(() => { active = true; UI.dragActive = true; el.classList.add('is-drag'); }, ev.pointerType === 'mouse' ? 120 : 350);
  const show = (text) => { if (e.all_day) el.textContent = text; else if (label) label.textContent = text; };
  const clear = () => {
    if (ghost) ghost.remove();
    if (cell) cell.classList.remove('is-drop');
    ghost = null; cell = null;
    el.style.visibility = '';
  };
  // the card may redraw while dragging (new data): pick up the new elements
  const sync = () => {
    if (el.isConnected && body.isConnected) return true;
    ghost = null; cell = null;
    body = UI.root.querySelector('.cw-body');
    cols = [...UI.root.querySelectorAll('.cw-col')];
    cells = [...UI.root.querySelectorAll('.cw-adbg > div')].slice(1);
    const k = UI.evs.findIndex((x) => x.cal === e.cal && x.uid === e.uid && x.rid === e.rid);
    const n = k < 0 ? null : UI.root.querySelector(`.cw-ev[data-i="${k}"], .cw-ad[data-i="${k}"]`);
    if (!body || cols.length <= i0 || !n) return false;
    el = n;
    label = el.querySelector('small');
    if (active) el.classList.add('is-drag');
    return true;
  };
  const move = (m) => {
    const dx = m.clientX - x0, dy = m.clientY - y0;
    if (!active) { if (Math.hypot(dx, dy) > 10) stop(); return; }
    if (!sync()) { target = null; up(); return; }
    if (m.cancelable) m.preventDefault();
    const i = colAt(m.clientX), col = cols[i];
    const day = new Date(Number(col.dataset.day));
    const shiftX = col.getBoundingClientRect().left - cols[i0].getBoundingClientRect().left;
    const rb = body.getBoundingClientRect();
    clear();
    let tg;
    if (m.clientY < rb.top) {
      const from = e.all_day ? F.day0(e.from, i - i0) : day;
      tg = { allDay: true, from, to: e.all_day ? F.day0(e.to, i - i0) : F.day0(day, 1) };
      cell = cells[i];
      if (cell) { cell.style.cssText = pst; cell.classList.add('is-drop'); }
      el.style.transform = `translate(${shiftX}px, ${e.all_day ? 0 : dy}px)`;
      show(`${e.all_day ? e.title + ' · ' : ''}${wd(from)} · ${t('cal_all_day')}`);
    } else if (e.all_day) {
      const r = col.getBoundingClientRect();
      const m0 = Math.round((H0 * 60 + (m.clientY - r.top) / r.height * hours * 60) / 15) * 15;
      const mins = Math.min(Math.max(m0, H0 * 60), (H0 + hours) * 60 - 60);
      const from = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, mins);
      tg = { allDay: false, from, to: new Date(from.getTime() + 3600000) };
      ghost = document.createElement('div');
      ghost.className = 'cw-ev cw-ghost';
      ghost.style.cssText = `top:${(mins / 60 - H0) / hours * 100}%;height:calc(${100 / hours}% - 2px);left:3px;width:calc(100% - 6px);${pst}`;
      ghost.innerHTML = `<b>${F.esc(e.title)}</b><small>${F.time(from)}–${F.time(tg.to)}</small>`;
      col.appendChild(ghost);
      el.style.visibility = 'hidden';
      show(`${e.title} · ${wd(from)} ${F.time(from)}`);
    } else {
      const mins = Math.round(dy / cols[i0].getBoundingClientRect().height * hours * 60 / 15) * 15;
      const from = new Date(day.getFullYear(), day.getMonth(), day.getDate(), e.from.getHours(), e.from.getMinutes() + mins);
      tg = { allDay: false, from, to: new Date(from.getTime() + (e.to - e.from)) };
      el.style.transform = `translate(${shiftX}px, ${mins / (hours * 60) * cols[i0].getBoundingClientRect().height}px)`;
      show(`${wd(from)} ${F.time(from)}`);
    }
    target = tg.allDay === e.all_day && tg.from.getTime() === e.from.getTime() ? null : tg;
    UI.dragMoved = UI.dragMoved || !!target;
  };
  const up = () => {
    if (!sync()) target = null;
    const was = active;
    stop();
    clear();
    setTimeout(() => { UI.dragMoved = false; }, 0);
    if (!was || !target) { el.style.transform = ''; if (e.all_day) el.textContent = text0; else if (label) label.textContent = label0; return; }
    el.classList.add('is-saving');
    const moved = { summary: e.title, from: target.from, to: target.to, allDay: target.allDay, loc: e.loc, desc: e.desc };
    const when = target.allDay ? `${wd(target.from)} · ${t('cal_all_day')}` : `${wd(target.from)} ${F.time(target.from)}`;
    UI.replace(e, e.cal, moved).then(() => {
      UI.done();
      UI.log(e.cal, `moved: ${e.title} (${calName(e.cal)}) ${stamp(e.from, e.all_day)} → ${stamp(target.from, target.allDay)}`);
      UI.toast(t('cal_moved', e.title, when), false, () => UI.find(e.cal, moved).then((f) => UI.replace(f, e.cal, asEv(e))));
    }).catch((err) => { UI.toast(errText(err), true); UI.done(); });
  };
  const stop = () => {
    clearTimeout(timer);
    UI.dragActive = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    el.classList.remove('is-drag');
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
};
// Swipe left/right: next/previous page. The grid follows the finger; from 70 px it turns the page.
const slide = (el, next) => {
  const body = el.querySelector('.cw-body, .cm');
  if (body) {
    body.style.transition = 'transform .18s, opacity .18s';
    body.style.transform = `translateX(${next ? -160 : 160}px)`;
    body.style.opacity = '0';
  }
  setTimeout(() => UI.go(next ? 1 : -1), 140);
};
UI.swipe = (ev, el) => {
  if (ev.button > 0) return;
  const body = el.querySelector('.cw-body, .cm');
  if (!body) return;
  const x0 = ev.clientX, y0 = ev.clientY;
  let dx = 0, horiz = null;
  UI.swiping = false;
  const reset = () => { body.style.transition = 'transform .18s, opacity .18s'; body.style.transform = ''; body.style.opacity = ''; };
  const move = (m) => {
    if (UI.dragActive) { stop(); reset(); return; }
    dx = m.clientX - x0;
    const dy = m.clientY - y0;
    if (horiz === null && Math.hypot(dx, dy) > 12) horiz = Math.abs(dx) > Math.abs(dy) * 1.3;
    if (!horiz) return;
    UI.swiping = true;
    if (m.cancelable) m.preventDefault();
    body.style.transition = 'none';
    body.style.transform = `translateX(${dx * 0.5}px)`;
    body.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / 800));
  };
  const up = () => {
    stop();
    if (!horiz) return;
    setTimeout(() => { UI.swiping = false; }, 0);
    if (Math.abs(dx) < 70) { reset(); return; }
    slide(el, dx < 0);
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
};
// Sideways scrolling (trackpad, mouse) turns pages too, one per gesture
UI.wheel = (ev, el) => {
  if (Math.abs(ev.deltaX) <= Math.abs(ev.deltaY)) return;
  if (ev.cancelable) ev.preventDefault();
  const now = Date.now();
  if (now < (UI.wheelPause || 0)) return;
  UI.wheelSum = (now - (UI.wheelAt || 0) > 300 ? 0 : UI.wheelSum || 0) + ev.deltaX;
  UI.wheelAt = now;
  if (Math.abs(UI.wheelSum) < 120) return;
  const next = UI.wheelSum > 0;
  UI.wheelSum = 0;
  UI.wheelPause = now + 700;
  slide(el, next);
};
// Tap in the grid. el: day column (time grid), day cell (month) or day head (all-day)
UI.tap = (ev, el) => {
  if (UI.dragMoved || UI.swiping) return;
  const hit = ev.target.closest('[data-i]');
  if (hit) return UI.show(UI.evs[Number(hit.dataset.i)]);
  const day = new Date(Number(el.dataset.day));
  if (el.dataset.h0) {
    const r = el.getBoundingClientRect();
    const h = Number(el.dataset.h0) + (ev.clientY - r.top) / r.height * Number(el.dataset.span);
    const half = Math.floor(h * 2) / 2;
    day.setHours(Math.floor(half), (half % 1) * 60, 0, 0);
    return UI.create(day, false);
  }
  if (el.dataset.allday) return UI.create(day, true);
  day.setHours(9, 0, 0, 0);
  return UI.create(day, false);
};
