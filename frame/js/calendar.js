// Google Calendar, delivered by the Apps Script web app (see apps-script/Code.gs).
// Views: 'month' (wall-calendar grid) and 'day' (hour-by-hour), switchable on screen;
// or 'agenda' (a list of upcoming days next to a bigger photo), set in config only.
(function (F) {
  var C = (F.cfg.calendar = F.cfg.calendar || {});
  var layout = C.view === 'agenda' ? 'agenda' : 'grid';
  var defaultMode = C.view === 'day' ? 'day' : 'month';
  var mode = defaultMode;    // 'month' | 'day' (grid layout)
  var shownMonth = null;     // first day of the month on screen
  var shownDay = null;       // midnight of the day on screen
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
  function monthOf(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }

  function eventsOn(events, d) {
    var d0 = dayStart(d), d1 = F.addDays(d0, 1);
    return events.filter(function (ev) { return ev.start < d1 && ev.end > d0; })
      .sort(function (a, b) { return (b.allDay - a.allDay) || (a.start - b.start); });
  }

  // Events that span midnight are drawn like all-day ones in the month grid and the day's top row.
  function isAllDayOn(ev, d) {
    return ev.allDay || ev.start < dayStart(d) || ev.end > F.addDays(dayStart(d), 1);
  }

  function shortTime(d) {
    if (F.cfg.use24HourClock) return F.formatTime(d);
    var h = d.getHours(), m = d.getMinutes();
    return ((h % 12) || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'a' : 'p');
  }

  function color(ev) { return F.esc(ev.color || 'var(--accent)'); }

  function eventRow(ev, d, now) {
    var time = ev.allDay ? 'All day' : (ev.start < dayStart(d) ? '…' : F.formatTime(ev.start));
    var happening = !ev.allDay && ev.start <= now && ev.end > now;
    return '<div class="cal-ev' + (happening ? ' now' : '') + '">'
      + '<span class="cal-bar" style="background:' + color(ev) + '"></span>'
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

  // Day view also uses the whole month grid, so flipping between days and back to
  // the month needs no new download.
  function currentRange() {
    if (layout === 'grid') return gridRange(mode === 'day' ? monthOf(shownDay) : shownMonth);
    var t = dayStart(new Date());
    return { start: t, end: F.addDays(t, C.daysAhead || 14) };
  }

  // ---------- header ----------
  function renderHeader() {
    var now = new Date();
    var title, atToday;
    if (mode === 'day') {
      title = (F.sameDay(shownDay, now) ? 'Today · ' : '') + shownDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      atToday = F.sameDay(shownDay, now);
    } else {
      title = shownMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
      atToday = sameMonth(shownMonth, now);
    }
    F.el('cal-title').textContent = title;
    F.el('cal-today').classList.toggle('hidden', atToday);
    F.el('cal-prev').setAttribute('aria-label', mode === 'day' ? 'Previous day' : 'Previous month');
    F.el('cal-next').setAttribute('aria-label', mode === 'day' ? 'Next day' : 'Next month');
    F.el('cal-mode-day').classList.toggle('on', mode === 'day');
    F.el('cal-mode-month').classList.toggle('on', mode === 'month');
  }

  // ---------- month view ----------
  function renderMonth(events) {
    var now = new Date();
    var r = gridRange(shownMonth);

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
          return isAllDayOn(ev, d)
            ? '<div class="me allday" style="background:' + color(ev) + '">' + F.esc(ev.title) + '</div>'
            : '<div class="me"><span class="me-dot" style="background:' + color(ev) + '"></span><span class="me-t">' + shortTime(ev.start) + '</span> ' + F.esc(ev.title) + '</div>';
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

  // ---------- day view ----------
  // Give overlapping events side-by-side columns, like Google Calendar.
  function layoutColumns(timed) {
    var cluster = [], colEnds = [], clusterEnd = 0;
    function close() {
      cluster.forEach(function (x) { x.cols = colEnds.length; });
      cluster = []; colEnds = [];
    }
    timed.forEach(function (x) {
      if (cluster.length && x.s >= clusterEnd) close();
      var col = colEnds.findIndex(function (end) { return end <= x.s; });
      if (col < 0) { col = colEnds.length; colEnds.push(0); }
      colEnds[col] = x.e;
      x.col = col;
      cluster.push(x);
      clusterEnd = Math.max(clusterEnd, x.e);
    });
    close();
  }

  function renderDay(events) {
    var now = new Date();
    var d0 = dayStart(shownDay), d1 = F.addDays(d0, 1);
    var list = events ? eventsOn(events, d0) : [];
    var allDay = list.filter(function (ev) { return isAllDayOn(ev, d0); });
    var timed = list.filter(function (ev) { return !isAllDayOn(ev, d0); }).map(function (ev) {
      return { ev: ev, s: (ev.start - d0) / 36e5, e: (Math.min(ev.end, d1) - d0) / 36e5 };
    }).sort(function (a, b) { return a.s - b.s || b.e - a.e; });

    // Show the usual waking hours, stretched to fit any earlier/later events.
    var h0 = C.dayViewStartHour != null ? C.dayViewStartHour : 7;
    var h1 = C.dayViewEndHour != null ? C.dayViewEndHour : 22;
    timed.forEach(function (x) { h0 = Math.min(h0, Math.floor(x.s)); h1 = Math.max(h1, Math.ceil(x.e)); });
    h0 = Math.max(0, h0); h1 = Math.min(24, Math.max(h1, h0 + 1));
    var span = h1 - h0;
    function pct(h) { return ((h - h0) / span * 100).toFixed(3) + '%'; }

    layoutColumns(timed);

    var hours = '';
    for (var h = h0; h <= h1; h++) {
      var label = h === 24 ? '' : shortTime(new Date(2000, 0, 1, h));
      hours += '<div class="dv-hour" style="top:' + pct(h) + '"><span>' + label + '</span></div>';
    }

    var blocks = timed.map(function (x) {
      var ev = x.ev;
      var happening = ev.start <= now && ev.end > now;
      var past = ev.end <= now;
      return '<div class="dv-ev' + (happening ? ' now' : '') + (past ? ' past' : '') + (x.e - x.s <= 0.8 ? ' short' : '') + '"'
        + ' style="top:' + pct(x.s) + ';height:calc(' + pct(h0 + (x.e - x.s)) + ' - 2px);'
        + 'left:calc(' + (x.col / x.cols * 100) + '% + 2px);width:calc(' + (100 / x.cols) + '% - 4px);'
        + '--c:' + color(ev) + '">'
        + '<div class="dv-title">' + F.esc(ev.title) + '</div>'
        + '<div class="dv-time">' + F.formatTime(ev.start) + ' – ' + F.formatTime(ev.end)
        + (ev.location ? ' · ' + F.esc(ev.location) : '') + '</div>'
        + '</div>';
    }).join('');

    var nowH = (now - d0) / 36e5;
    var nowLine = F.sameDay(now, d0) && nowH >= h0 && nowH <= h1
      ? '<div class="dv-now" style="top:' + pct(nowH) + '"></div>' : '';

    F.el('calendar-body').innerHTML = '<div class="dayview">'
      + (allDay.length ? '<div class="dv-allday">' + allDay.map(function (ev) {
        return '<div class="me allday" style="background:' + color(ev) + '">' + F.esc(ev.title) + '</div>';
      }).join('') + '</div>' : '')
      + '<div class="dv-grid">' + hours
      + '<div class="dv-events">' + blocks + nowLine + '</div>'
      + (events && !list.length ? '<div class="dv-empty">Nothing planned</div>' : '')
      + '</div></div>';
  }

  // ---------- navigation ----------
  function shift(delta) {
    lastTouch = lastShift = Date.now();
    if (mode === 'day') {
      var oldMonth = monthOf(shownDay);
      shownDay = F.addDays(shownDay, delta);
      if (!sameMonth(oldMonth, shownDay)) { shownMonth = monthOf(shownDay); lastEvents = null; load(); }
    } else {
      shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + delta, 1);
      lastEvents = null;
      load();
    }
    render();
  }

  function setMode(m, day) {
    lastTouch = Date.now();
    var before = currentRange();
    mode = m;
    if (day) shownDay = dayStart(day);
    if (mode === 'month') shownMonth = monthOf(shownDay);
    var after = currentRange();
    if (+before.start !== +after.start) { lastEvents = null; load(); }
    render();
  }

  function goToday() {
    lastTouch = Date.now();
    var n = new Date();
    var needLoad = !sameMonth(mode === 'day' ? shownDay : shownMonth, n);
    shownDay = dayStart(n);
    shownMonth = monthOf(n);
    if (needLoad) { lastEvents = null; load(); }
    render();
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
    if (layout === 'agenda') { if (lastEvents) renderAgenda(lastEvents); return; }
    renderHeader();
    if (mode === 'day') renderDay(lastEvents);
    else renderMonth(lastEvents);
  }

  function load() {
    if (!F.cfg.googleScriptUrl) {
      var msg = '<div class="empty-sm">Connect your Google Calendar:<br>'
        + '<button class="setup-link" onclick="FrameSetup.open()">Set up</button></div>';
      if (layout === 'agenda') F.el('calendar-body').innerHTML = msg;
      else { F.el('cal-note').innerHTML = msg; render(); }
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
        if (layout === 'agenda') F.el('calendar-body').innerHTML = '';
      }
    });
  }

  F.startCalendar = function () {
    document.body.classList.add(layout === 'grid' ? 'cal-month' : 'cal-agenda');
    var now = new Date();
    shownDay = dayStart(now);
    shownMonth = monthOf(now);

    if (layout === 'grid') {
      F.el('cal-nav').classList.remove('hidden');
      F.el('cal-prev').onclick = function () { shift(-1); };
      F.el('cal-next').onclick = function () { shift(1); };
      F.el('cal-today').onclick = goToday;
      F.el('cal-mode-day').onclick = function () {
        // From the month grid, "Day" opens today if it's on screen, otherwise the 1st.
        setMode('day', sameMonth(shownMonth, new Date()) ? new Date() : shownMonth);
      };
      F.el('cal-mode-month').onclick = function () { setMode('month'); };
      F.onSwipe(F.el('calendar-body'), function () { shift(1); }, function () { shift(-1); });
      // Tap a day in the month grid to open it in day view.
      F.el('calendar-body').addEventListener('click', function (e) {
        var cell = e.target.closest('.mc');
        if (cell && Date.now() - lastShift > 500) setMode('day', new Date(cell.getAttribute('data-day') + 'T00:00:00'));
      });
      window.addEventListener('resize', function () { render(); });
    }

    render();
    load();
    F.every(C.refreshMinutes || 5, function () {
      // After 5 idle minutes, go back to the starting view on today (also rolls over at midnight).
      if (layout === 'grid' && Date.now() - lastTouch > 5 * 60000) {
        var n = new Date();
        var stale = mode !== defaultMode || !F.sameDay(shownDay, n) || !sameMonth(shownMonth, n);
        if (stale) {
          mode = defaultMode;
          shownDay = dayStart(n);
          shownMonth = monthOf(n);
          lastEvents = null;
          render();
        }
      }
      load();
    });
    // Re-render every minute so "today" and the current-time line stay accurate.
    setInterval(render, 60000);
  };
})(window.Frame);
