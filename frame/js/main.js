(function (F) {
  function keepAwake() {
    if (!('wakeLock' in navigator)) return;
    var req = function () { navigator.wakeLock.request('screen').catch(function () {}); };
    req();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') req();
    });
  }

  // Devices may keep the page itself for a while after an update. Ask the server for the
  // current version (bypassing any saved copy) and switch to it if it's newer.
  function currentVersion() {
    var m = document.querySelector('meta[name="app-version"]');
    return m ? m.content : '';
  }

  function checkForUpdate(orElse) {
    fetch(location.pathname + '?check=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var m = /name="app-version" content="([^"]+)"/.exec(html);
        var target = m && m[1] !== currentVersion() ? m[1] : null;
        // Only try once per version, so a stubborn saved copy can't cause a reload loop.
        if (target && new URLSearchParams(location.search).get('v') !== target) {
          location.replace(location.pathname + '?v=' + encodeURIComponent(target));
        } else if (orElse) orElse();
      })
      .catch(function () { if (orElse) orElse(); });
  }

  // When the device wakes up after a while asleep (or the app comes back to the front),
  // reload so everything on screen is current straight away.
  function refreshOnWake() {
    var hiddenAt = null;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 60000) {
        checkForUpdate(function () { location.reload(); });
      }
    });
  }

  function goFullscreen() {
    var de = document.documentElement;
    if (!document.fullscreenElement && de.requestFullscreen) de.requestFullscreen().catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    F.startClock();
    F.startWeather();
    F.startCalendar();
    F.startHockey();
    F.startPhotos();
    F.startTabs();
    F.startCountdown();
    F.startMeals();
    F.startLaundry();
    if (F.cfg.keepScreenOn) keepAwake();
    refreshOnWake();
    checkForUpdate();

    // Browsers only allow fullscreen after a tap; the first tap anywhere does it.
    document.addEventListener('pointerup', goFullscreen, { once: true });

    var hours = F.cfg.reloadEveryHours;
    if (hours > 0) setTimeout(function () { location.reload(); }, hours * 3600000);
  });
})(window.Frame);
