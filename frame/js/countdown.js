// Countdowns ("12 days until 🎄 Christmas") in the corner of the photo.
// They come from Google Calendar events tagged #countdown, plus any in config.countdown.items.
(function (F) {
  var C = F.cfg.countdown || {};
  var fromCalendar = [];
  var index = 0;
  var timer = null;

  function daysUntil(ymd) {
    var target = new Date(ymd + 'T00:00:00');
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 864e5);
  }

  function upcoming() {
    var all = fromCalendar.concat(C.items || []).filter(function (c) {
      return c && c.date && daysUntil(c.date) >= 0;
    });
    var seen = {};
    all = all.filter(function (c) {
      var k = c.title + '|' + c.date;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
    all.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return all.slice(0, C.maxShown || 5);
  }

  function render() {
    var box = F.el('countdown');
    var list = upcoming();
    if (!list.length) { box.classList.add('hidden'); return; }
    index = index % list.length;
    var c = list[index];
    var n = daysUntil(c.date);
    var num, label;
    if (n === 0) { num = '🎉'; label = 'Today!'; }
    else if (n === 1) { num = '1'; label = 'day until'; }
    else { num = String(n); label = 'days until'; }
    box.style.setProperty('--c', c.color || 'var(--accent)');
    box.innerHTML = '<div class="cd-num">' + F.esc(num) + '</div>'
      + '<div class="cd-text"><div class="cd-label">' + label + '</div>'
      + '<div class="cd-title">' + F.esc(c.title) + '</div></div>'
      + (list.length > 1 ? '<div class="cd-dots">' + list.map(function (_, i) {
        return '<span' + (i === index ? ' class="on"' : '') + '></span>';
      }).join('') + '</div>' : '');
    box.classList.remove('hidden');
  }

  function next() { index++; render(); }

  F.setCountdowns = function (list) {
    fromCalendar = (list || []).map(function (c) { return { title: c.title, date: c.date, color: c.color }; });
    render();
  };

  F.startCountdown = function () {
    var box = F.el('countdown');
    // Tap to see the next countdown straight away.
    box.addEventListener('click', function (e) {
      e.stopPropagation();
      next();
      clearInterval(timer);
      timer = setInterval(next, (C.secondsEach || 8) * 1000);
    });
    box.addEventListener('pointerup', function (e) { e.stopPropagation(); });   // not a photo double-tap
    render();
    timer = setInterval(next, (C.secondsEach || 8) * 1000);
    setInterval(render, 60000);   // roll over at midnight
  };
})(window.Frame);
