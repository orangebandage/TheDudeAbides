// On-device setup: the Google script address and access key are typed in once on the
// frame/iPad and saved there, so they never have to go into config.js (or GitHub).
// Open it again any time by pressing and holding the big clock for 2 seconds.
(function () {
  var KEY = 'familyFrame.google';
  var cfg = window.FRAME_CONFIG = window.FRAME_CONFIG || {};

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  // Values saved on this device win over config.js.
  var saved = readSaved();
  if (saved && saved.url) {
    cfg.googleScriptUrl = saved.url;
    cfg.accessKey = saved.key || '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function open() {
    if (document.getElementById('setup')) return;
    var box = document.createElement('div');
    box.id = 'setup';
    box.innerHTML = '<form class="setup-card" autocomplete="off">'
      + '<h3>Connect Google Calendar &amp; Photos</h3>'
      + '<p class="muted small">Paste the Web app URL from your Google script (it ends in <code>/exec</code>) and the ACCESS_KEY you chose. '
      + 'They are saved only on this device.</p>'
      + '<label>Web app URL<input name="url" type="url" inputmode="url" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(cfg.googleScriptUrl) + '"></label>'
      + '<label>Access key<input name="key" type="text" spellcheck="false" autocapitalize="off" placeholder="(leave empty if you did not set one)" value="' + esc(cfg.accessKey) + '"></label>'
      + '<div class="setup-msg small"></div>'
      + '<div class="setup-btns">'
      + '<button type="button" class="setup-forget">Forget</button>'
      + '<span style="flex:1"></span>'
      + '<button type="button" class="setup-cancel">Cancel</button>'
      + '<button type="submit" class="setup-save">Test &amp; save</button>'
      + '</div></form>';
    document.body.appendChild(box);

    var form = box.querySelector('form');
    var msg = box.querySelector('.setup-msg');
    function close() { box.remove(); }

    box.querySelector('.setup-cancel').onclick = close;
    box.querySelector('.setup-forget').onclick = function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    };
    form.onsubmit = function (e) {
      e.preventDefault();
      var url = form.url.value.trim();
      var key = form.key.value.trim();
      if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
        msg.textContent = 'That doesn’t look like the Web app URL. It should start with https://script.google.com/ and end with /exec.';
        msg.className = 'setup-msg small bad';
        return;
      }
      msg.textContent = 'Checking…';
      msg.className = 'setup-msg small';
      var test = url + '?what=events' + (key ? '&key=' + encodeURIComponent(key) : '');
      fetch(test).then(function (r) { return r.json(); }).then(function (d) {
        if (d.error) throw new Error(d.error);
        try {
          localStorage.setItem(KEY, JSON.stringify({ url: url, key: key }));
        } catch (err) {
          throw new Error('This browser would not save the settings (private browsing?).');
        }
        msg.textContent = 'Connected! Found ' + (d.events || []).length + ' events. Reloading…';
        msg.className = 'setup-msg small good';
        setTimeout(function () { location.reload(); }, 1200);
      }).catch(function (err) {
        msg.textContent = 'Could not connect: ' + err.message + '. Check the URL and access key, and that the script is deployed with access for "Anyone".';
        msg.className = 'setup-msg small bad';
      });
    };
  }

  window.FrameSetup = { open: open };

  document.addEventListener('DOMContentLoaded', function () {
    // Press and hold the big clock for 2 seconds to open setup.
    var clock = document.getElementById('clock');
    var t = null;
    clock.addEventListener('pointerdown', function () { t = setTimeout(open, 2000); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      clock.addEventListener(ev, function () { clearTimeout(t); });
    });
    if (/[?&#]setup\b/.test(location.href) || !cfg.googleScriptUrl) open();
  });
})();
