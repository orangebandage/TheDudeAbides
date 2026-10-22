(function (F) {
  function tick() {
    var now = new Date();
    var t = F.formatTime(now);
    var ampm = /\s?([AP]M)$/i.exec(t);
    F.el('time').innerHTML = ampm
      ? F.esc(t.slice(0, ampm.index)) + '<span class="ampm">' + ampm[1].toUpperCase() + '</span>'
      : F.esc(t);
    F.el('date').textContent = now.toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    worldClocks(now);
    nightDim(now);
  }

  // Extra clocks for other places, e.g. family in another time zone.
  function worldClocks(now) {
    var list = F.cfg.worldClocks || [];
    var box = F.el('world-clocks');
    if (!list.length) { box.innerHTML = ''; return; }
    var hereDay = F.ymd(now);
    box.innerHTML = list.map(function (c) {
      var time, day;
      try {
        time = now.toLocaleTimeString([], { timeZone: c.timeZone, hour: 'numeric', minute: '2-digit', hour12: !F.cfg.use24HourClock });
        day = now.toLocaleDateString('en-CA', { timeZone: c.timeZone });   // YYYY-MM-DD
      } catch (e) {
        return '';   // unknown time zone name
      }
      var note = day > hereDay ? 'tomorrow' : day < hereDay ? 'yesterday' : '';
      return '<div class="wc">'
        + '<div class="wc-label">' + F.esc(c.label) + '</div>'
        + '<div class="wc-time">' + F.esc(time) + (note ? ' <span class="wc-day">' + note + '</span>' : '') + '</div>'
        + '</div>';
    }).join('');
  }

  function nightDim(now) {
    var n = F.cfg.nightDim || {};
    var dim = F.el('night-dim');
    if (!n.enabled) { dim.style.opacity = 0; return; }
    var h = now.getHours();
    var night = n.fromHour > n.toHour
      ? (h >= n.fromHour || h < n.toHour)
      : (h >= n.fromHour && h < n.toHour);
    dim.style.opacity = night ? (n.opacity || 0.6) : 0;
  }

  F.startClock = function () {
    tick();
    setInterval(tick, 1000);
  };
})(window.Frame);
