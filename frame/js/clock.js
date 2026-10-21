(function (F) {
  function tick() {
    var now = new Date();
    F.el('time').textContent = F.formatTime(now).replace(/\s?[AP]M$/i, '');
    F.el('date').textContent = now.toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    nightDim(now);
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
