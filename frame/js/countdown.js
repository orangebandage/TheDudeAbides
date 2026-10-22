// Countdowns: a full list on the ⏳ Countdowns tab of the hockey panel, and optionally
// (countdown.showOnPhoto) a rotating "N days until …" badge on the photo.
// They come from Google Calendar events tagged #countdown, plus any in config.countdown.items.
(function (F) {
  var C = F.cfg.countdown || {};
  var TAB_KEY = 'familyFrame.tab';
  var fromCalendar = [];
  var index = 0;
  var timer = null;

  // A leading emoji becomes the row's icon: "🎸 Underoath" -> icon 🎸, title "Underoath".
  var LEADING_EMOJI = /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u;

  function split(title) {
    var m = LEADING_EMOJI.exec(title || '');
    return m ? { icon: m[1], title: title.slice(m[0].length) || title } : { icon: '⏳', title: title || 'Countdown' };
  }

  function daysUntil(ymd) {
    var target = new Date(ymd + 'T00:00:00');
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 864e5);
  }

  function upcoming(max) {
    var seen = {};
    var all = fromCalendar.concat(C.items || []).filter(function (c) {
      if (!c || !c.date || daysUntil(c.date) < 0) return false;
      var k = c.title + '|' + c.date;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
    all.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return max ? all.slice(0, max) : all;
  }

  // ---------- badge on the photo ----------
  function renderBadge() {
    var box = F.el('countdown');
    var list = upcoming(C.maxShown || 5);
    if (!C.showOnPhoto || !list.length) { box.classList.add('hidden'); return; }
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

  // ---------- full list ----------
  function renderList() {
    var box = F.el('countdown-list');
    var list = upcoming(C.listMax || 30);
    if (!list.length) {
      box.innerHTML = '<div class="empty-sm">No countdowns yet.<br>'
        + '<span class="muted small">Add <b>#countdown</b> to an event in Google Calendar.</span></div>';
      return;
    }
    box.innerHTML = list.map(function (c) {
      var n = daysUntil(c.date);
      var t = split(c.title);
      var date = new Date(c.date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      var days = n === 0 ? '<div class="cdl-num">🎉</div><div class="cdl-unit">today!</div>'
        : '<div class="cdl-num">' + n + '</div><div class="cdl-unit">' + (n === 1 ? 'day left' : 'days left') + '</div>';
      return '<div class="cdl-row' + (n === 0 ? ' today' : '') + '" style="--c:' + F.esc(c.color || 'var(--accent)') + '">'
        + '<span class="cdl-bar"></span>'
        + '<span class="cdl-icon">' + F.esc(t.icon) + '</span>'
        + '<div class="cdl-main"><div class="cdl-title">' + F.esc(t.title) + '</div>'
        + '<div class="cdl-date">' + date + '</div></div>'
        + '<div class="cdl-days">' + days + '</div>'
        + '</div>';
    }).join('');
  }

  function render() { renderBadge(); renderList(); }

  // ---------- tabs ----------
  function showTab(name) {
    var countdown = name === 'countdown';
    F.el('hockey').classList.toggle('show-countdown', countdown);
    F.el('countdown-list').classList.toggle('hidden', !countdown);
    F.el('tab-hockey').classList.toggle('on', !countdown);
    F.el('tab-countdown').classList.toggle('on', countdown);
    try { localStorage.setItem(TAB_KEY, name); } catch (e) {}
  }

  F.setCountdowns = function (list) {
    fromCalendar = (list || []).map(function (c) { return { title: c.title, date: c.date, color: c.color }; });
    render();
  };

  F.startCountdown = function () {
    F.el('tab-hockey').onclick = function () { showTab('hockey'); };
    F.el('tab-countdown').onclick = function () { showTab('countdown'); };
    var saved = null;
    try { saved = localStorage.getItem(TAB_KEY); } catch (e) {}
    showTab(saved === 'countdown' ? 'countdown' : 'hockey');

    // Tap the badge on the photo to open the full list.
    var badge = F.el('countdown');
    badge.addEventListener('click', function (e) { e.stopPropagation(); showTab('countdown'); });
    badge.addEventListener('pointerup', function (e) { e.stopPropagation(); });   // not a photo double-tap

    render();
    timer = setInterval(function () { index++; renderBadge(); }, (C.secondsEach || 8) * 1000);
    setInterval(render, 60000);   // roll over at midnight
  };
})(window.Frame);
