// Weekly meal plan from a Google Sheet (column A = day, column B = meal),
// shown on the 🍽️ Meals tab with today highlighted.
(function (F) {
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var byDay = null;   // { 0: 'Pizza pizza', ... } by weekday number

  // A matching food emoji for the meal; a meal that starts with an emoji keeps its own.
  var FOOD = [
    [/pizza/i, '🍕'], [/burger|whopper|big mac/i, '🍔'], [/grilled cheese|sandwich|sub\b|panini/i, '🥪'],
    [/taco/i, '🌮'], [/burrito|wrap|quesadilla/i, '🌯'], [/pasta|spaghetti|lasagn|mac.*cheese|alfredo/i, '🍝'],
    [/ramen|noodle|pho|lo mein/i, '🍜'], [/sushi/i, '🍣'], [/curry/i, '🍛'], [/stir.?fry|chinese|fried rice/i, '🥡'],
    [/soup|chili|stew/i, '🍲'], [/salad/i, '🥗'], [/chicken|wings/i, '🍗'], [/steak|beef|roast/i, '🥩'],
    [/rib|bbq|pork/i, '🍖'], [/fish|salmon|shrimp|seafood/i, '🐟'], [/hot ?dog/i, '🌭'],
    [/breakfast|pancake|waffle|egg/i, '🥞'], [/cheese/i, '🧀'], [/leftover/i, '🥡'], [/out|restaurant|take.?out/i, '🛍️'],
  ];
  var LEADING_EMOJI = /^\s*((?:\p{Extended_Pictographic})(?:️|‍\p{Extended_Pictographic})*)\s*/u;

  function iconFor(meal) {
    var m = LEADING_EMOJI.exec(meal);
    if (m) return { icon: m[1], text: meal.slice(m[0].length) };
    for (var i = 0; i < FOOD.length; i++) if (FOOD[i][0].test(meal)) return { icon: FOOD[i][1], text: meal };
    return { icon: '🍽️', text: meal };
  }

  function render() {
    var box = F.el('meals-list');
    if (!byDay) {
      box.innerHTML = '<div class="empty-sm">No meal plan yet.<br>'
        + '<span class="muted small">Add your Google Sheet to the script (see README).</span></div>';
      return;
    }
    var today = new Date().getDay();
    var first = (F.cfg.calendar || {}).weekStartsOnMonday ? 1 : 0;
    var html = '';
    for (var i = 0; i < 7; i++) {
      var d = (first + i) % 7;
      var meal = byDay[d] || '';
      var t = meal ? iconFor(meal) : null;
      html += '<div class="ml-row' + (d === today ? ' today' : '') + (meal ? '' : ' empty') + '">'
        + '<span class="ml-icon">' + (t ? F.esc(t.icon) : '') + '</span>'
        + '<span class="ml-day">' + (d === today ? 'Today' : DAYS[d]) + '</span>'
        + '<span class="ml-meal">' + (t ? F.esc(t.text) : '—') + '</span>'
        + '</div>';
    }
    box.innerHTML = html;
    var row = box.querySelector('.ml-row.today');
    if (row) box.scrollTop = Math.max(0, row.offsetTop - box.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2);
  }

  F.setMeals = function (rows) {
    byDay = {};
    (rows || []).forEach(function (r) {
      var i = DAYS.findIndex(function (name) { return name.toLowerCase().indexOf(String(r.day).trim().toLowerCase().slice(0, 3)) === 0; });
      if (i >= 0 && String(r.day).trim()) byDay[i] = String(r.meal || '').trim();
    });
    render();
  };

  F.renderMeals = function () { render(); };

  F.startMeals = function () {
    render();
    setInterval(render, 60000);   // move "Today" at midnight
  };
})(window.Frame);
