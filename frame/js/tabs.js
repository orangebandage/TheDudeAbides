// Tabs on the bottom-right panel: 🏒 Hockey, ⏳ Countdowns, 🍽️ Meals.
// The chosen tab is remembered on the device.
(function (F) {
  var KEY = 'familyFrame.tab';
  var TABS = { hockey: null, countdown: 'countdown-list', meals: 'meals-list' };

  F.showTab = function (name) {
    if (!(name in TABS)) name = 'hockey';
    var panel = F.el('hockey');
    panel.classList.toggle('show-other', name !== 'hockey');
    Object.keys(TABS).forEach(function (t) {
      F.el('tab-' + t).classList.toggle('on', t === name);
      if (TABS[t]) F.el(TABS[t]).classList.toggle('hidden', t !== name);
    });
    try { localStorage.setItem(KEY, name); } catch (e) {}
    if (name === 'meals' && F.renderMeals) F.renderMeals();   // re-centre on today
  };

  F.startTabs = function () {
    Object.keys(TABS).forEach(function (t) {
      F.el('tab-' + t).onclick = function () { F.showTab(t); };
    });
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    F.showTab(saved);
  };
})(window.Frame);
