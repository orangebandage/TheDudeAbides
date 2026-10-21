// Google Calendar agenda, delivered by the Apps Script web app (see apps-script/Code.gs).
(function (F) {
  var lastEvents = null;

  // All-day events arrive as 'YYYY-MM-DD' (end is exclusive); timed events as ISO timestamps.
  function parse(ev) {
    var allDay = !!ev.allDay;
    var start = allDay ? new Date(ev.start + 'T00:00:00') : new Date(ev.start);
    var end = allDay ? new Date(ev.end + 'T00:00:00') : new Date(ev.end);
    return { title: ev.title || '(No title)', location: ev.location, color: ev.color, allDay: allDay, start: start, end: end };
  }

  function render(events) {
    var body = F.el('calendar-body');
    var now = new Date();
    var today0 = new Date(now); today0.setHours(0, 0, 0, 0);
    var days = (F.cfg.calendar || {}).daysAhead || 14;

    // Spread events over each day they cover, so multi-day events show on every day.
    var byDay = {};
    events.map(parse).forEach(function (ev) {
      if (ev.end <= now) return;
      for (var i = 0; i < days; i++) {
        var d0 = F.addDays(today0, i), d1 = F.addDays(today0, i + 1);
        if (ev.start < d1 && ev.end > d0) {
          (byDay[F.ymd(d0)] = byDay[F.ymd(d0)] || []).push(ev);
        }
      }
    });

    var keys = Object.keys(byDay).sort();
    if (!keys.length) {
      body.innerHTML = '<div class="empty-sm">Nothing on the calendar 🎉</div>';
      return;
    }

    body.innerHTML = keys.map(function (k) {
      var d = new Date(k + 'T00:00:00');
      var list = byDay[k].sort(function (a, b) {
        return (b.allDay - a.allDay) || (a.start - b.start);
      });
      var isToday = F.sameDay(d, now);
      return '<div class="cal-day' + (isToday ? ' today' : '') + '">'
        + '<div class="cal-dlabel">' + F.dayLabel(d)
        + (isToday || F.sameDay(d, F.addDays(now, 1)) ? ' <span class="muted">' + d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + '</span>' : '')
        + '</div>'
        + list.map(function (ev) {
          var time = ev.allDay ? 'All day'
            : (ev.start < d ? '…' : F.formatTime(ev.start));
          var happening = !ev.allDay && ev.start <= now && ev.end > now;
          return '<div class="cal-ev' + (happening ? ' now' : '') + '">'
            + '<span class="cal-bar" style="background:' + F.esc(ev.color || 'var(--accent)') + '"></span>'
            + '<span class="cal-time">' + time + '</span>'
            + '<span class="cal-title">' + F.esc(ev.title)
            + (ev.location ? '<span class="cal-loc">' + F.esc(ev.location) + '</span>' : '')
            + '</span></div>';
        }).join('')
        + '</div>';
    }).join('');
  }

  function load() {
    if (!F.cfg.googleScriptUrl) {
      F.el('calendar-body').innerHTML = '<div class="empty-sm">Connect your Google Calendar:<br>'
        + '<span class="muted small">set <code>googleScriptUrl</code> in <code>js/config.js</code> (see README)</span></div>';
      return;
    }
    return F.scriptData('events', 60000).then(function (d) {
      lastEvents = d.events || [];
      render(lastEvents);
    }).catch(function (err) {
      console.warn('calendar', err);
      if (!lastEvents) F.el('calendar-body').innerHTML = '<div class="empty-sm">Calendar unavailable<br><span class="muted small">' + F.esc(err.message) + '</span></div>';
    });
  }

  F.startCalendar = function () {
    load();
    F.every((F.cfg.calendar || {}).refreshMinutes || 5, load);
    // Re-render every minute so "now" highlighting and past events stay accurate.
    setInterval(function () { if (lastEvents) render(lastEvents); }, 60000);
  };
})(window.Frame);
