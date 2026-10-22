// Small shared helpers. Everything hangs off window.Frame so the app works
// from file:// as well as a web server (no ES modules needed).
window.Frame = window.Frame || {};

(function (F) {
  F.cfg = window.FRAME_CONFIG || {};

  F.el = function (id) { return document.getElementById(id); };

  F.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  F.fetchJson = function (url, timeoutMs) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 20000);
    return fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
        return r.json();
      })
      .finally(function () { clearTimeout(t); });
  };

  // Build a URL to the Google Apps Script web app.
  F.scriptUrl = function (params) {
    var base = F.cfg.googleScriptUrl;
    if (!base) return null;
    var q = Object.assign({}, params || {});
    if (F.cfg.accessKey) q.key = F.cfg.accessKey;
    var qs = Object.keys(q).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]);
    }).join('&');
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + qs;
  };

  // The script response is shared by calendar + photos; fetch it once per refresh window.
  var scriptCache = {};
  F.scriptData = function (what, maxAgeMs, extra) {
    var url = F.scriptUrl(Object.assign({ what: what }, extra || {}));
    if (!url) return Promise.reject(new Error('googleScriptUrl not set'));
    var c = scriptCache[url];
    if (c && Date.now() - c.at < (maxAgeMs || 0)) return c.promise;
    var p = F.fetchJson(url, 45000).then(function (d) {
      if (d && d.error) throw new Error(d.error);
      return d;
    });
    scriptCache[url] = { at: Date.now(), promise: p };
    p.catch(function () { delete scriptCache[url]; });
    return p;
  };

  F.ymd = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  F.sameDay = function (a, b) { return F.ymd(a) === F.ymd(b); };

  F.addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };

  F.formatTime = function (d) {
    return d.toLocaleTimeString([], {
      hour: 'numeric', minute: '2-digit', hour12: !F.cfg.use24HourClock,
    });
  };

  F.dayLabel = function (d) {
    var today = new Date();
    if (F.sameDay(d, today)) return 'Today';
    if (F.sameDay(d, F.addDays(today, 1))) return 'Tomorrow';
    if (F.sameDay(d, F.addDays(today, -1))) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Horizontal swipe detection for touch screens (also works with a mouse).
  F.onSwipe = function (node, onLeft, onRight) {
    var x0 = null, y0 = null;
    node.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; });
    node.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        (dx < 0 ? onLeft : onRight)();
      }
    });
    node.addEventListener('pointercancel', function () { x0 = null; });
  };

  F.every = function (minutes, fn) {
    return setInterval(fn, Math.max(0.25, minutes) * 60000);
  };
})(window.Frame);
