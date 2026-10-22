// Laundry card: who filled it last, shown next to the world clocks.
// Tap it to see the date it was filled and to record a new fill.
// Saved on this device only.
(function (F) {
  var L = F.cfg.laundry || {};
  var KEY = 'familyFrame.laundry';
  var people = L.people || [];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  function save(name) {
    var rec = { name: name, date: F.ymd(new Date()) };
    try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) {}
    return rec;
  }

  function person(name) {
    return people.filter(function (p) { return p.name === name; })[0] || { name: name, color: 'var(--accent)' };
  }

  function render() {
    var rec = load();
    var p = rec ? person(rec.name) : null;
    F.el('laundry').innerHTML = '<div class="wc-label">🧺 Laundry card</div>'
      + '<div class="wc-time">'
      + (p ? '<span class="ld-dot" style="background:' + F.esc(p.color) + '"></span>' + F.esc(p.name)
        : '<span class="ld-none">Tap to set</span>')
      + '</div>';
  }

  function close() {
    var box = F.el('ld-popup');
    if (box) box.remove();
  }

  function open() {
    close();
    var rec = load();
    var last = rec
      ? 'Last filled by <b>' + F.esc(rec.name) + '</b> on <b>'
        + new Date(rec.date + 'T00:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + '</b>'
      : 'No fill recorded yet.';
    var box = document.createElement('div');
    box.id = 'ld-popup';
    box.innerHTML = '<div class="ld-card">'
      + '<h3>🧺 Laundry card</h3>'
      + '<p class="ld-last">' + last + '</p>'
      + '<p class="muted small">Who just filled it?</p>'
      + '<div class="ld-btns">' + people.map(function (p) {
        return '<button data-name="' + F.esc(p.name) + '" style="background:' + F.esc(p.color) + '">' + F.esc(p.name) + '</button>';
      }).join('') + '</div>'
      + '<button class="ld-cancel">Cancel</button>'
      + '</div>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-name]');
      if (b) { save(b.getAttribute('data-name')); render(); close(); return; }
      if (e.target === box || e.target.closest('.ld-cancel')) close();
    });
    document.body.appendChild(box);
    setTimeout(close, 60000);
  }

  F.startLaundry = function () {
    var el = F.el('laundry');
    if (!L.enabled || !people.length) { el.classList.add('hidden'); return; }
    el.addEventListener('click', open);
    render();
  };
})(window.Frame);
