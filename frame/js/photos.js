// Photo slideshow. Photos come from a Google Drive folder (via the Apps Script)
// and/or files listed in config.photos.local.
(function (F) {
  var P = F.cfg.photos || {};
  var list = [];          // [{key, url?, id?}]
  var order = [];         // indexes into list, possibly shuffled
  var pos = -1;
  var timer = null, paused = false;
  var front = 'a';
  var listLoaded = false;
  var dataCache = {};     // id -> data URL (private Drive mode)
  var cacheKeys = [];

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function rebuildOrder(keepKey) {
    order = list.map(function (_, i) { return i; });
    if (P.shuffle) shuffle(order);
    pos = -1;
    if (keepKey) {
      var i = order.findIndex(function (o) { return list[o].key === keepKey; });
      if (i >= 0) pos = i;
    }
  }

  // Resolve a photo to something an <img> can show.
  function srcFor(p) {
    if (p.url) return Promise.resolve(p.url);
    if (dataCache[p.id]) return Promise.resolve(dataCache[p.id]);
    return F.fetchJson(F.scriptUrl({ photo: p.id }), 60000).then(function (d) {
      if (!d.data) throw new Error(d.error || 'no image data');
      dataCache[p.id] = d.data;
      cacheKeys.push(p.id);
      while (cacheKeys.length > 4) delete dataCache[cacheKeys.shift()];   // keep memory small
      return d.data;
    });
  }

  function preload(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(src); };
      img.onerror = function () { rej(new Error('image failed to load')); };
      img.src = src;
    });
  }

  var busy = false;
  function show(delta, attempts) {
    if (!list.length || busy) return;
    attempts = attempts || 0;
    if (attempts >= Math.min(list.length, 5)) return;
    busy = true;
    pos = (pos + delta + order.length) % order.length;
    var p = list[order[pos]];
    srcFor(p).then(preload).then(function (src) {
      var back = front === 'a' ? 'b' : 'a';
      var layer = F.el('photo-' + back);
      var css = 'url("' + src.replace(/"/g, '%22') + '")';
      layer.innerHTML = '<div class="photo-blur"></div><div class="photo-img"></div>';
      layer.firstChild.style.backgroundImage = css;
      layer.lastChild.style.backgroundImage = css;
      layer.classList.add('show');
      F.el('photo-' + front).classList.remove('show');
      front = back;
      busy = false;
      // Warm up the next one.
      var next = list[order[(pos + 1) % order.length]];
      if (next && next !== p) srcFor(next).then(preload).catch(function () {});
    }).catch(function (err) {
      console.warn('photo', p, err);
      busy = false;
      show(delta || 1, attempts + 1);
    });
  }

  function restartTimer() {
    clearInterval(timer);
    if (!paused) timer = setInterval(function () { show(1); }, (P.intervalSeconds || 30) * 1000);
  }

  function setList(newList) {
    var current = pos >= 0 && list[order[pos]] ? list[order[pos]].key : null;
    var changed = newList.map(function (p) { return p.key; }).join('|') !== list.map(function (p) { return p.key; }).join('|');
    if (!changed && listLoaded) return;
    listLoaded = true;
    list = newList;
    rebuildOrder(current);
    F.el('photo-empty').classList.toggle('hidden', list.length > 0);
    if (!list.length) {
      F.el('photo-a').classList.remove('show');
      F.el('photo-b').classList.remove('show');
      return;
    }
    if (pos < 0) show(1);
  }

  function load() {
    var local = (P.local || []).map(function (u) { return { key: 'local:' + u, url: u }; });
    if (!F.cfg.googleScriptUrl) { setList(local); return; }
    return F.scriptData('photos', 60000).then(function (d) {
      var drive = (d.photos || []).map(function (p) { return { key: 'drive:' + p.id, id: p.id, url: p.url }; });
      setList(drive.concat(local));
    }).catch(function (err) {
      console.warn('photo list', err);
      if (!list.length) setList(local);
    });
  }

  function togglePause() {
    paused = !paused;
    var b = F.el('photo-pause');
    b.textContent = paused ? '▶' : '❚❚';
    b.classList.toggle('paused', paused);
    restartTimer();
  }

  F.startPhotos = function () {
    document.body.classList.add('photo-' + (['small', 'large'].indexOf(P.size) >= 0 ? P.size : 'medium'));
    var box = F.el('photos');
    F.el('photo-prev').onclick = function (e) { e.stopPropagation(); show(-1); restartTimer(); };
    F.el('photo-next').onclick = function (e) { e.stopPropagation(); show(1); restartTimer(); };
    F.el('photo-pause').onclick = function (e) { e.stopPropagation(); togglePause(); };
    F.onSwipe(box, function () { show(1); restartTimer(); }, function () { show(-1); restartTimer(); });
    // Double-tap the photo to make it fill the whole screen (and back).
    var lastTap = 0;
    box.addEventListener('pointerup', function (e) {
      if (e.target.closest('button')) return;
      var now = Date.now();
      if (now - lastTap < 350) { document.body.classList.toggle('photo-full'); lastTap = 0; }
      else lastTap = now;
    });
    load();
    restartTimer();
    F.every(P.refreshListMinutes || 30, load);
  };
})(window.Frame);
