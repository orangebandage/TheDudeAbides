(function (F) {
  function keepAwake() {
    if (!('wakeLock' in navigator)) return;
    var req = function () { navigator.wakeLock.request('screen').catch(function () {}); };
    req();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') req();
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
    keepAwake();

    // Browsers only allow fullscreen after a tap; the first tap anywhere does it.
    document.addEventListener('pointerup', goFullscreen, { once: true });

    var hours = F.cfg.reloadEveryHours;
    if (hours > 0) setTimeout(function () { location.reload(); }, hours * 3600000);
  });
})(window.Frame);
