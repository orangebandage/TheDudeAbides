// Google Calendar, delivered by the Apps Script web app (see apps-script/Code.gs).
// Two views: 'month' (a full wall-calendar grid) and 'agenda' (a list of upcoming days).
(function (F) {
  var C = (F.cfg.calendar = F.cfg.calendar || {});
  var view = C.view === 'agenda' ? 'agenda' : 'month';
  var shownMonth = null;     // first day of the month on screen
  var lastEvents = null;     // parsed events for the current range
  var lastTouch = 0;
  var lastShift = 0;
  var loadSeq = 0;

  // All-day events arrive as 'YYYY-MM-DD' (end is exclusive); timed events as ISO timestamps.
  function parse(ev) {
    var allDay = !!ev.allDay;
    var start = allDay ? new Date(ev.start + 'T00:00:00') : new Date(ev.start);
    var end = allDay ? new Date(ev.end + 'T00:00:00') : new Date(ev.end);
    return { title: ev.title || '(No title)', location: ev.location, color: ev.color, allDay: allDay, start: start, end: end };
  }

  function dayStart(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  function eventsOn(events, d) {
    var d0 = dayStart(d), d1 = F.addDays(d0, 1);
    return events.filter(function (ev) { return ev.start < d1 && ev.end > d0; })
      .sort(function (a, b) { return (b.allDay - a.allDay) || (a.start - b.start); });
  }

  function shortTime(d) {
    if (F.cfg.use24HourClock) return F.formatTime(d);
    var h = d.getHours(), m = d.getMinutes();
    return ((h % 12) || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'a' : 'p');
  }

  function eventRow(ev, d, now) {
    var time = ev.allDay ? 'All day' : (ev.start < dayStart(d) ? '…' : F.formatTime(ev.start));
    var happening = !ev.allDay && ev.start <= now && ev.end > now;
    return '<div class="cal-ev' + (happening ? ' now' : '') + '">'
      + '<span class="cal-bar" style="background:' + F.esc(ev.color || 'var(--accent)') + '"></span>'
      + '<span class="cal-time">' + time + '</span>'
      + '<span class="cal-title">' + F.esc(ev.title)
      + (ev.location ? '<span class="cal-loc">' + F.esc(ev.location) + '</span>' : '')
      + '</span></div>';
  }

  // ---------- range ----------
  function weekStart() { return C.weekStartsOnMonday ? 1 : 0; }

  function gridRange(month) {
    var first = new Date(month.getFullYear(), month.getMonth(), 1);
    var start = F.addDays(first, -((first.getDay() - weekStart() + 7) % 7));
    var last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    var end = F.addDays(last, 7 - ((last.getDay() - weekStart() + 7) % 7));   // exclusive
    return { start: start, end: end };
  }

  function currentRange() {
    if (view === 'month') return gridRange(shownMonth);
    var t = dayStart(new Date());
    return { start: t, end: F.addDays(t, C.daysAhead || 14) };
  }

  // ---------- month view ----------
  function renderMonth(events) {
    var now = new Date();
    var r = gridRange(shownMonth);
    F.el('cal-title').textContent = shownMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
    F.el('cal-today').classList.toggle('hidden', shownMonth.getMonth() === now.getMonth() && shownMonth.getFullYear() === now.getFullYear());

    var head = '';
    for (var i = 0; i < 7; i++) {
      head += '<div class="mh">' + F.addDays(r.start, i).toLocaleDateString([], { weekday: 'short' }) + '</div>';
    }

    var cells = '';
    for (var d = new Date(r.start); d < r.end; d = F.addDays(d, 1)) {
      var cls = 'mc';
      if (d.getMonth() !== shownMonth.getMonth()) cls += ' other';
      if (F.sameDay(d, now)) cls += ' today';
      if (dayStart(d) < dayStart(now)) cls += ' past';
      var list = events ? eventsOn(events, d) : [];
      cells += '<div class="' + cls + '" data-day="' + F.ymd(d) + '">'
        + '<div class="mc-num">' + d.getDate() + '</div>'
        + '<div class="mc-evs">' + list.map(function (ev) {
          var color = F.esc(ev.color || 'var(--accent)');
          return ev.allDay || ev.start < dayStart(d)
            ? '<div class="me allday" style="background:' + color + '">' + F.esc(ev.title) + '</div>'
            : '<div class="me"><span class="me-dot" style="background:' + color + '"></span><span class="me-t">' + shortTime(ev.start) + '</span> ' + F.esc(ev.title) + '</div>';
        }).join('') + '</div>'
        + '<div class="mc-more hidden"></div>'
        + '</div>';
    }

    var weeks = Math.round((r.end - r.start) / (7 * 864e5));
    F.el('calendar-body').innerHTML = '<div class="month" style="grid-template-rows:auto repeat(' + weeks + ', minmax(0, 1fr))">' + head + cells + '</div>';
    fitCells();
  }

  // Hide events that don't fit in a day box and show "+N more" instead.
  function fitCells() {
    var cells = F.el('calendar-body').querySelectorAll('.mc');
    Array.prototype.forEach.call(cells, function (cell) {
      var box = cell.querySelector('.mc-evs');
      var evs = box.children;
      if (!evs.length || box.scrollHeight <= box.clientHeight + 1) return;
      var more = cell.querySelector('.mc-more');
      more.classList.remove('hidden');
      var hidden = 0;
      for (var i = evs.length - 1; i >= 0 && box.scrollHeight > box.clientHeight + 1; i--) {
        evs[i].style.display = 'none';
        hidden++;
        more.textContent = '+' + hidden + ' more';
      }
    });
  }

  function openDay(ymd) {
    var d = new Date(ymd + 'T00:00:00');
    var list = lastEvents ? eventsOn(lastEvents, d) : [];
    var now = new Date();
    F.el('day-popup-title').textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    F.el('day-popup-body').innerHTML = list.length
      ? list.map(function (ev) { return eventRow(ev, d, now); }).join('')
      : '<div class="empty-sm">Nothing planned</div>';
    F.el('day-popup').classList.remove('hidden');
    clearTimeout(openDay.t);
    openDay.t = setTimeout(closeDay, 60000);
  }

  function closeDay() { F.el('day-popup').classList.add('hidden'); }

  function shiftMonth(delta) {
    lastTouch = lastShift = Date.now();
    shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + delta, 1);
    lastEvents = null;
    renderMonth(null);
    load();
  }

  // ---------- agenda view ----------
  function renderAgenda(events) {
    var body = F.el('calendar-body');
    var now = new Date();
    var today0 = dayStart(now);
    var days = C.daysAhead || 14;
    var html = '';
    for (var i = 0; i < days; i++) {
      var d = F.addDays(today0, i);
      var list = eventsOn(events, d).filter(function (ev) { return ev.end > now; });
      if (!list.length) continue;
      var isToday = i === 0;
      html += '<div class="cal-day' + (isToday ? ' today' : '') + '">'
        + '<div class="cal-dlabel">' + F.dayLabel(d)
        + (i < 2 ? ' <span class="muted">' + d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + '</span>' : '')
        + '</div>'
        + list.map(function (ev) { return eventRow(ev, d, now); }).join('')
        + '</div>';
    }
    body.innerHTML = html || '<div class="empty-sm">Nothing on the calendar 🎉</div>';
  }

  // ---------- loading ----------
  function render() {
    if (view === 'month') renderMonth(lastEvents);
    else if (lastEvents) renderAgenda(lastEvents);
  }

  function load() {
    if (!F.cfg.googleScriptUrl) {
      if (view === 'month') renderMonth(null);
      var msg = '<div class="empty-sm">Connect your Google Calendar:<br>'
        + '<span class="muted small">set <code>googleScriptUrl</code> in <code>js/config.js</code> (see README)</span></div>';
      if (view === 'agenda') F.el('calendar-body').innerHTML = msg;
      else F.el('cal-note').innerHTML = msg;
      return;
    }
    var r = currentRange();
    var seq = ++loadSeq;
    return F.scriptData('events', 60000, { start: F.ymd(r.start), end: F.ymd(r.end) }).then(function (d) {
      if (seq !== loadSeq) return;            // a newer request (e.g. month change) won
      lastEvents = (d.events || []).map(parse);
      F.el('cal-note').innerHTML = '';
      render();
    }).catch(function (err) {
      console.warn('calendar', err);
      if (seq !== loadSeq) return;
      if (!lastEvents) {
        F.el('cal-note').innerHTML = '<div class="empty-sm">Calendar unavailable<br><span class="muted small">' + F.esc(err.message) + '</span></div>';
        if (view === 'agenda') F.el('calendar-body').innerHTML = '';
      }
    });
  }

  F.startCalendar = function () {
    document.body.classList.add(view === 'month' ? 'cal-month' : 'cal-agenda');
    var now = new Date();
    shownMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (view === 'month') {
      F.el('cal-nav').classList.remove('hidden');
      F.el('cal-prev').onclick = function () { shiftMonth(-1); };
      F.el('cal-next').onclick = function () { shiftMonth(1); };
      F.el('cal-today').onclick = function () {
        var n = new Date();
        shiftMonth((n.getFullYear() - shownMonth.getFullYear()) * 12 + n.getMonth() - shownMonth.getMonth());
      };
      F.onSwipe(F.el('calendar-body'), function () { shiftMonth(1); }, function () { shiftMonth(-1); });
      F.el('calendar-body').addEventListener('click', function (e) {
        var cell = e.target.closest('.mc');
        if (cell && Date.now() - lastShift > 500) { lastTouch = Date.now(); openDay(cell.getAttribute('data-day')); }
      });
      F.el('day-popup').addEventListener('click', function (e) {
        if (e.target.id === 'day-popup' || e.target.closest('.popup-close')) closeDay();
      });
      window.addEventListener('resize', function () { render(); });
    }

    load();
    F.every(C.refreshMinutes || 5, function () {
      // After 5 idle minutes, go back to the current month (also rolls over at month end).
      var n = new Date();
      if (view === 'month' && Date.now() - lastTouch > 5 * 60000
        && (shownMonth.getMonth() !== n.getMonth() || shownMonth.getFullYear() !== n.getFullYear())) {
        shownMonth = new Date(n.getFullYear(), n.getMonth(), 1);
        lastEvents = null;
        closeDay();
      }
      load();
    });
    // Re-render every minute so "today" and "happening now" stay accurate.
    setInterval(render, 60000);
  };
})(window.Frame);
