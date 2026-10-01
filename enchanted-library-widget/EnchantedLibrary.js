// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-brown; icon-glyph: book-open;

// Enchanted Library — a Goodreads bookshelf widget for Scriptable.
//
// Paints a candle-lit, dark-wood library bookcase in the spirit of the Beast's
// library: an arched, gilded crown, leather-bound spines tinted from each
// book's cover, a brass candlestick, and the enchanted rose under glass.
//
//   • "Currently reading" books stand face-out, marked with a satin ribbon.
//   • "Favorites" stand as spines with their titles in gold.
//
// Works in small, medium and large home-screen widgets.
// Your Goodreads profile must be public, because the widget reads Goodreads'
// public shelf RSS feeds (Goodreads no longer offers an API).

const CONFIG = {
  goodreadsUserId: "183463841",
  readingShelf: "currently-reading", // shown face-out with a ribbon bookmark
  spineShelf: "favorites",           // shown as spines
  libraryName: "My Library",         // script lettering on the large widget ("" to hide)
  fillEmptySpace: true,              // pad shelves with untitled antique volumes
  showRose: true,                    // the enchanted rose under glass
  showCandle: true,                  // a lit brass candlestick
  refreshHours: 3,
};

// ---------------------------------------------------------------------------
// Entry point

const FM = FileManager.local();
const CACHE_DIR = FM.joinPath(FM.documentsDirectory(), "enchanted-library");
if (!FM.fileExists(CACHE_DIR)) FM.createDirectory(CACHE_DIR, true);

const PROFILE_URL = `https://www.goodreads.com/user/show/${CONFIG.goodreadsUserId}`;
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Cinzel:wght@700"
  + "&family=Cormorant+Garamond:ital,wght@1,600&family=Pinyon+Script&display=block";

async function main() {
  let family = config.widgetFamily || "medium";
  if (!config.runsInWidget) {
    family = await choosePreview();
    if (!family) return;
  }

  const library = await loadLibrary();
  const widget = family.startsWith("accessory")
    ? buildAccessoryWidget(family, library)
    : await buildWidget(family, library);

  widget.url = PROFILE_URL;
  widget.refreshAfterDate = new Date(Date.now() + CONFIG.refreshHours * 3600 * 1000);

  if (config.runsInWidget) {
    Script.setWidget(widget);
    return;
  }
  if (family === "small") await widget.presentSmall();
  else if (family === "large") await widget.presentLarge();
  else await widget.presentMedium();
  // Save renders of the other sizes too; widgets fall back to these if iOS
  // ever refuses to paint inside the widget itself.
  for (const other of ["small", "medium", "large"]) {
    if (other !== family) await buildWidget(other, library);
  }
}

async function choosePreview() {
  const alert = new Alert();
  alert.title = "Enchanted Library";
  alert.message = "Preview which size?";
  ["Small", "Medium", "Large"].forEach(s => alert.addAction(s));
  alert.addDestructiveAction("Clear cache & refresh");
  alert.addCancelAction("Cancel");
  const choice = await alert.presentSheet();
  if (choice === 3) {
    for (const f of FM.listContents(CACHE_DIR)) FM.remove(FM.joinPath(CACHE_DIR, f));
    return "medium";
  }
  return ["small", "medium", "large"][choice] || null;
}

// ---------------------------------------------------------------------------
// Goodreads data

async function loadLibrary() {
  const cachePath = FM.joinPath(CACHE_DIR, "shelves.json");
  let cached = null;
  if (FM.fileExists(cachePath)) {
    try { cached = JSON.parse(FM.readString(cachePath)); } catch (e) { cached = null; }
  }
  try {
    const [reading, spines] = await Promise.all([
      fetchShelf(CONFIG.readingShelf),
      fetchShelf(CONFIG.spineShelf),
    ]);
    const data = { reading, spines, fetchedAt: Date.now() };
    FM.writeString(cachePath, JSON.stringify(data));
    return data;
  } catch (e) {
    if (cached) return Object.assign(cached, { stale: true });
    return { reading: [], spines: [], error: String((e && e.message) || e) };
  }
}

async function fetchShelf(shelf) {
  const url = `https://www.goodreads.com/review/list_rss/${CONFIG.goodreadsUserId}`
    + `?shelf=${encodeURIComponent(shelf)}`;
  const req = new Request(url);
  req.timeoutInterval = 20;
  req.headers = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" };
  const xml = await req.loadString();
  const status = req.response && req.response.statusCode;
  if (status && status >= 400) throw new Error(`Goodreads returned HTTP ${status}`);
  if (!/<rss[\s>]/i.test(xml)) throw new Error("Goodreads feed unavailable — is the profile public?");
  return parseFeed(xml);
}

function parseFeed(xml) {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/g) || [];
  return items
    .map(block => {
      const get = name => xmlText(block, name);
      const small = get("book_small_image_url") || get("book_image_url") || get("book_medium_image_url");
      const large = get("book_large_image_url") || get("book_medium_image_url") || small;
      return {
        id: get("book_id") || get("guid"),
        title: get("title"),
        author: get("author_name"),
        cover: bestCoverUrl(large),
        thumb: /nophoto/i.test(small) ? null : small || null,
        added: Date.parse(get("user_date_added")) || 0,
      };
    })
    .filter(b => b.title)
    .sort((a, b) => b.added - a.added);
}

function xmlText(block, name) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  const raw = m[1].trim().replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1");
  return decodeEntities(raw).trim();
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// Goodreads serves thumbnails like ".../1234._SY475_.jpg"; dropping the size
// token returns the full-resolution cover. "nophoto" means there is no cover.
function bestCoverUrl(url) {
  if (!url || /nophoto/i.test(url)) return null;
  return url.replace(/\._[A-Z]{2}\d+_(?=\.\w+$)/, "");
}

// Returns the image as a base64 data URL (cached on disk), or null.
async function imageDataUrl(url, key) {
  if (!url) return null;
  const path = FM.joinPath(CACHE_DIR, `${key.replace(/\W/g, "_")}.img`);
  let data = FM.fileExists(path) ? FM.read(path) : null;
  if (!data) {
    try {
      data = await new Request(url).load();
      if (data) FM.write(path, data);
    } catch (e) {
      return null;
    }
  }
  return data ? `data:image/jpeg;base64,${data.toBase64String()}` : null;
}

// ---------------------------------------------------------------------------
// Lock-screen widgets (text only)

function buildAccessoryWidget(family, library) {
  const w = new ListWidget();
  const book = library.reading[0] || library.spines[0];
  const title = book ? book.title.replace(/\s*\([^)]*#[^)]*\)\s*$/, "") : "No books yet";
  if (family === "accessoryRectangular") {
    const head = w.addText(library.reading[0] ? "NOW READING" : "FAVORITE");
    head.font = Font.semiboldSystemFont(10);
    const t = w.addText(title);
    t.font = Font.boldSystemFont(14);
    t.lineLimit = 2;
    if (book && book.author) {
      const a = w.addText(book.author);
      a.font = Font.systemFont(11);
      a.lineLimit = 1;
    }
  } else {
    const t = w.addText(title);
    t.font = Font.semiboldSystemFont(12);
    t.lineLimit = 1;
  }
  return w;
}

// ---------------------------------------------------------------------------
// Home-screen widget

// Approximate widget sizes (points) by screen width. The background image is
// aspect-filled, so only the proportions really matter.
function widgetSize(family) {
  const screen = Device.screenSize();
  const sw = Math.min(screen.width, screen.height);
  const small = Math.round(sw * 0.405);
  const wide = Math.round(sw * 0.86);
  if (family === "small") return { width: small, height: small };
  if (family === "large" || family === "extraLarge") return { width: wide, height: Math.round(wide * 1.05) };
  return { width: wide, height: small };
}

async function buildWidget(family, library) {
  if (family === "extraLarge") family = "large";
  const size = widgetSize(family);
  const maxCovers = { small: 1, medium: 2, large: 3 }[family] || 2;

  const seen = new Set();
  const unique = books => books.filter(b => !seen.has(b.id) && seen.add(b.id));
  const reading = unique(library.reading);
  const faceOut = reading.slice(0, maxCovers);
  const spineBooks = reading.slice(maxCovers).concat(unique(library.spines)).slice(0, 40);

  const scene = {
    family,
    width: size.width,
    height: size.height,
    scale: Math.min(3, Device.screenScale()),
    config: CONFIG,
    note: noteFor(library, faceOut, spineBooks),
    covers: [],
    spines: [],
  };
  for (const b of faceOut) {
    scene.covers.push({ id: b.id, title: b.title, author: b.author, src: await imageDataUrl(b.cover, `cover-${b.id}`) });
  }
  for (const b of spineBooks) {
    scene.spines.push({ id: b.id, title: b.title, author: b.author, src: await imageDataUrl(b.thumb, `thumb-${b.id}`) });
  }

  const renderPath = FM.joinPath(CACHE_DIR, `render-${family}.png`);
  let image = null;
  try {
    image = await paint(scene);
    FM.writeImage(renderPath, image);
  } catch (e) {
    console.error(`Render failed: ${e}`);
    if (FM.fileExists(renderPath)) image = FM.readImage(renderPath);
  }

  const w = new ListWidget();
  w.setPadding(0, 0, 0, 0);
  w.backgroundColor = new Color("#140804");
  if (image) {
    w.backgroundImage = image;
  } else {
    const t = w.addText("Open Scriptable and run Enchanted Library once to set up your shelves.");
    t.textColor = new Color("#f2d47c");
    t.font = Font.italicSystemFont(12);
  }
  return w;
}

function noteFor(library, covers, spines) {
  if (covers.length || spines.length) return "";
  if (library.error) return "Couldn’t reach Goodreads.\nIs your profile public?";
  return `No books on “${CONFIG.readingShelf}”\nor “${CONFIG.spineShelf}” yet.`;
}

// Paints the scene in a WebView canvas (Scriptable's own drawing API can't do
// gradients, soft shadows or rotated text) and returns it as an Image.
async function paint(scene) {
  const wv = new WebView();
  await wv.loadHTML(`<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="${FONT_CSS}"></head>
    <body style="margin:0;background:#000"><canvas id="c"></canvas></body></html>`);
  const js = `
    ${renderLibrary.toString()}
    (async () => {
      try {
        const scene = ${JSON.stringify(scene)};
        const fonts = ["700 20px Cinzel", "italic 600 20px 'Cormorant Garamond'", "20px 'Pinyon Script'"];
        await Promise.race([
          Promise.all(fonts.map(f => document.fonts.load(f))),
          new Promise(r => setTimeout(r, 4000)),
        ]);
        const load = src => new Promise(res => {
          if (!src) return res(null);
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => res(null);
          img.src = src;
        });
        for (const b of scene.covers.concat(scene.spines)) b.img = await load(b.src);
        const canvas = document.getElementById("c");
        canvas.width = Math.round(scene.width * scene.scale);
        canvas.height = Math.round(scene.height * scene.scale);
        renderLibrary(canvas, scene, (w, h) => {
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          return c;
        });
        completion(canvas.toDataURL("image/png").split(",")[1]);
      } catch (e) {
        completion("ERR:" + e.message);
      }
    })();`;
  const result = await wv.evaluateJavaScript(js, true);
  if (!result || result.startsWith("ERR:")) throw new Error(result ? result.slice(4) : "empty render");
  return Image.fromData(Data.fromBase64String(result));
}

// ---------------------------------------------------------------------------
// The painter. Pure Canvas 2D, self-contained so it can run inside the
// WebView (and in tools/preview.js on a computer).
// <renderer>
function renderLibrary(canvas, scene, makeCanvas) {
  const W = scene.width, H = scene.height, S = scene.scale;
  const cfg = scene.config;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(S, 0, 0, S, 0, 0);

  const L = {
    small:  { unitW: 170, shelves: 1, band: 9,  rise: 13, title: false },
    medium: { unitW: 364, shelves: 1, band: 8,  rise: 15, title: false },
    large:  { unitW: 364, shelves: 2, band: 44, rise: 18, title: true },
  }[scene.family] || { unitW: 364, shelves: 1, band: 8, rise: 15, title: false };

  const u = W / L.unitW;
  const f = (scene.family === "small" ? 10 : 13) * u;   // pillar width
  const band = L.band * u, rise = L.rise * u;
  const baseH = 10 * u, plank = 9 * u;
  const innerL = f, innerR = W - f, innerW = innerR - innerL;
  const top = band + rise * 0.55;
  const slotH = (H - baseH - top) / L.shelves;

  const FONT_SPINE = "Cinzel, 'Trajan Pro', Baskerville, serif";
  const FONT_ITALIC = "'Cormorant Garamond', Baskerville, Georgia, serif";
  const FONT_SCRIPT = "'Pinyon Script', 'Snell Roundhand', cursive";

  // ---- utilities ---------------------------------------------------------
  function seeded(str) {
    let h = 1779033703 ^ String(str).length;
    for (let i = 0; i < String(str).length; i++) {
      h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = seeded(scene.family + W + "x" + H);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function hsl2rgb(h, s, l) {
    const k = n => (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const fn = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [fn(0) * 255, fn(8) * 255, fn(4) * 255];
  }
  function rgb2hsl(c) {
    const [r, g, b] = c.map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  }

  const LEATHER = ["#6b1a1f", "#7a2030", "#1f4a35", "#2c5530", "#1d2c4f", "#2b3a6b",
    "#4a2545", "#7a4220", "#8a6232", "#5a3520", "#1f4f52", "#7c6222", "#2a201c"].map(hex);

  // A cover's dominant (saturation-weighted) color, turned into rich leather.
  function leatherFrom(img, key) {
    const r = seeded(key);
    let base = LEATHER[Math.floor(r() * LEATHER.length)];
    if (img) {
      try {
        const c = makeCanvas(12, 18);
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0, 12, 18);
        const d = x.getImageData(0, 0, 12, 18).data;
        let tr = 0, tg = 0, tb = 0, tw = 0;
        for (let i = 0; i < d.length; i += 4) {
          const [, s, l] = rgb2hsl([d[i], d[i + 1], d[i + 2]]);
          const wgt = 0.05 + s * (1 - Math.abs(l - 0.5) * 1.6);
          tr += d[i] * wgt; tg += d[i + 1] * wgt; tb += d[i + 2] * wgt; tw += wgt;
        }
        const [h, s] = rgb2hsl([tr / tw, tg / tw, tb / tw]);
        if (s > 0.12) base = hsl2rgb(h, clamp(s * 0.85, 0.3, 0.62), 0.2 + r() * 0.12);
      } catch (e) { /* keep palette color */ }
    }
    return base;
  }

  function roundRect(x, y, w, h, r) {
    const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }

  function gold(x0, y0, x1, y1, a = 1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    [[0, "#6e4a12"], [0.22, "#d9ae52"], [0.42, "#fff0b5"], [0.58, "#c8952f"], [0.82, "#f0cf78"], [1, "#7a5418"]]
      .forEach(([o, c]) => g.addColorStop(o, a === 1 ? c : rgba(hex(c), a)));
    return g;
  }

  const noise = (() => {
    const n = 96;
    const c = makeCanvas(n, n);
    const x = c.getContext("2d");
    const img = x.createImageData(n, n);
    const r = seeded("noise");
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return ctx.createPattern(c, "repeat");
  })();

  function texture(alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = noise;
    ctx.fill();
    ctx.restore();
  }

  function grain(x, y, w, h, vertical, count, alpha) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let i = 0; i < count; i++) {
      const amp = (0.5 + rng() * 2) * u;
      ctx.beginPath();
      if (vertical) {
        let px = x + rng() * w;
        ctx.moveTo(px, y);
        for (let yy = y; yy < y + h; yy += 18 * u) {
          ctx.quadraticCurveTo(px + (rng() - 0.5) * amp * 2, yy + 9 * u, px + (rng() - 0.5) * amp, yy + 18 * u);
        }
      } else {
        const py = y + rng() * h;
        ctx.moveTo(x, py);
        for (let xx = x; xx < x + w; xx += 24 * u) {
          ctx.quadraticCurveTo(xx + 12 * u, py + (rng() - 0.5) * amp * 2, xx + 24 * u, py + (rng() - 0.5) * amp);
        }
      }
      ctx.strokeStyle = rng() < 0.6 ? `rgba(0,0,0,${alpha})` : `rgba(255,190,130,${alpha * 0.6})`;
      ctx.lineWidth = (0.3 + rng() * 0.8) * u;
      ctx.stroke();
    }
    ctx.restore();
  }

  function glow(x, y, r, color, a, mode = "screen") {
    ctx.save();
    ctx.globalCompositeOperation = mode;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.4, rgba(color, a * 0.45));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
  }

  function sparkle(x, y, r, color) {
    ctx.save();
    ctx.shadowColor = rgba(color, 0.9);
    ctx.shadowBlur = r * 3;
    ctx.fillStyle = rgba(mix(color, [255, 255, 255], 0.6), 0.95);
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
    ctx.restore();
  }

  function shortTitle(t) {
    return t.replace(/\s*\([^)]*#[^)]*\)\s*$/, "").split(/:\s/)[0].trim();
  }

  // ---- back wall ---------------------------------------------------------
  function backWall() {
    const g = ctx.createRadialGradient(W / 2, top, 0, W / 2, top + H * 0.2, Math.max(W, H) * 0.95);
    g.addColorStop(0, "#5c3519");
    g.addColorStop(0.45, "#2e170a");
    g.addColorStop(1, "#110603");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const boards = Math.max(3, Math.round(innerW / (48 * u)));
    for (let i = 1; i < boards; i++) {
      const x = innerL + (innerW * i) / boards;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(x - 0.6 * u, 0, 1.2 * u, H);
      ctx.fillStyle = "rgba(255,200,150,0.05)";
      ctx.fillRect(x + 0.6 * u, 0, 1 * u, H);
    }
    grain(innerL, 0, innerW, H, true, Math.round(innerW / (4 * u)), 0.08);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    texture(0.08);

    // Soft shafts of light from a high window.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const [x0, w0, a] of [[0.12, 0.1, 0.07], [0.3, 0.07, 0.05], [0.44, 0.12, 0.05]]) {
      const g2 = ctx.createLinearGradient(0, 0, W * 0.4, H);
      g2.addColorStop(0, `rgba(255,214,160,${a})`);
      g2.addColorStop(1, "rgba(255,214,160,0)");
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(W * x0, 0);
      ctx.lineTo(W * (x0 + w0), 0);
      ctx.lineTo(W * (x0 + w0 + 0.35), H);
      ctx.lineTo(W * (x0 + 0.3), H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- books -------------------------------------------------------------
  function spine(x, baseY, w, h, color, title, key, muted) {
    const r = seeded(key);
    const y = baseY - h;
    const radius = [1.6 * u, 1.6 * u, 0.4 * u, 0.4 * u];

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 6 * u;
    ctx.shadowOffsetX = 2.5 * u;
    ctx.fillStyle = rgba(color);
    roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.restore();

    // Rounded-spine shading.
    roundRect(x, y, w, h, radius);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(0,0,0,0.6)");
    g.addColorStop(0.1, "rgba(0,0,0,0.12)");
    g.addColorStop(0.28, "rgba(255,235,210,0.2)");
    g.addColorStop(0.45, "rgba(255,235,210,0.05)");
    g.addColorStop(0.75, "rgba(0,0,0,0.15)");
    g.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = g;
    ctx.fill();
    texture(0.22);
    const tg = ctx.createLinearGradient(0, y, 0, y + 10 * u);
    tg.addColorStop(0, "rgba(0,0,0,0.35)");
    tg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = tg;
    ctx.fillRect(x, y, w, 10 * u);

    const style = Math.floor(r() * 3);
    const bandAlpha = muted ? 0.55 : 1;

    // Raised ribs with gilt lines.
    const ribs = style === 1 ? [0.07, 0.15, 0.85, 0.93] : [0.08, 0.92];
    for (const t of ribs) {
      const ry = y + h * t;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x + 0.5 * u, ry + 1.6 * u, w - u, 0.8 * u);
      ctx.fillStyle = "rgba(255,240,220,0.12)";
      ctx.fillRect(x + 0.5 * u, ry - 1.4 * u, w - u, 0.6 * u);
      ctx.fillStyle = gold(x, ry, x + w, ry, bandAlpha);
      ctx.fillRect(x + 0.6 * u, ry - 0.6 * u, w - 1.2 * u, 0.7 * u);
      ctx.fillRect(x + 0.6 * u, ry + 0.8 * u, w - 1.2 * u, 0.4 * u);
    }
    if (muted || !title) {
      if (r() < 0.5) {
        ctx.fillStyle = gold(x, 0, x + w, 0, 0.5);
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h * 0.5, Math.min(w * 0.18, 2.2 * u), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    const t0 = y + h * (style === 1 ? 0.19 : 0.13), t1 = y + h * (style === 1 ? 0.81 : 0.87);

    // Title label panel on some volumes.
    if (style === 2) {
      const lx = x + 1.4 * u, lw = w - 2.8 * u;
      ctx.fillStyle = rgba(mix(color, [10, 4, 2], 0.62));
      ctx.fillRect(lx, t0, lw, t1 - t0);
      ctx.strokeStyle = gold(lx, 0, lx + lw, 0);
      ctx.lineWidth = 0.6 * u;
      ctx.strokeRect(lx + 0.8 * u, t0 + 0.8 * u, lw - 1.6 * u, t1 - t0 - 1.6 * u);
    }

    // Gilt title, running down the spine.
    const room = (t1 - t0) - 6 * u;
    let text = shortTitle(title);
    let fs = Math.min(w * 0.44, 10.5 * u);
    ctx.font = `700 ${fs}px ${FONT_SPINE}`;
    while (ctx.measureText(text).width > room && fs > 6 * u) {
      fs -= 0.25 * u;
      ctx.font = `700 ${fs}px ${FONT_SPINE}`;
    }
    if (ctx.measureText(text).width > room) {
      const words = text.split(" ");
      while (words.length > 1 && ctx.measureText(words.join(" ") + "…").width > room) words.pop();
      text = words.join(" ");
      while (text.length > 1 && ctx.measureText(text + "…").width > room) text = text.slice(0, -1);
      text += "…";
    }
    ctx.save();
    ctx.translate(x + w / 2 + fs * 0.04, (t0 + t1) / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 1.2 * u;
    ctx.shadowOffsetY = -0.6 * u;
    ctx.fillStyle = gold(0, -fs / 2, 0, fs / 2);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function cover(x, baseY, w, h, book) {
    const y = baseY - h;
    const radius = [0.6 * u, 1.8 * u, 1.8 * u, 0.6 * u];

    // Page block peeking out on the right.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 10 * u;
    ctx.shadowOffsetX = 4 * u;
    ctx.shadowOffsetY = 1 * u;
    ctx.fillStyle = "#e9dcc0";
    roundRect(x + 1.5 * u, y + 1.5 * u, w, h - 1.5 * u, radius);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(120,95,60,${0.25 - i * 0.04})`;
      ctx.fillRect(x + w + 0.2 * u + i * 0.35 * u, y + 2 * u, 0.2 * u, h - 3 * u);
    }

    ctx.save();
    roundRect(x, y, w, h, radius);
    ctx.clip();
    if (book.img) {
      const ir = book.img.width / book.img.height;
      let sw = book.img.width, sh = book.img.height, sx = 0, sy = 0;
      if (ir > w / h) { sw = sh * (w / h); sx = (book.img.width - sw) / 2; }
      else { sh = sw / (w / h); sy = (book.img.height - sh) / 2; }
      ctx.drawImage(book.img, sx, sy, sw, sh, x, y, w, h);
    } else {
      const c = leatherFrom(null, book.id + "cover");
      ctx.fillStyle = rgba(c);
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = noise;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = gold(x, y, x + w, y + h);
      ctx.lineWidth = 0.9 * u;
      ctx.strokeRect(x + 4 * u, y + 4 * u, w - 8 * u, h - 8 * u);
      ctx.fillStyle = gold(x, y, x + w, y + h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const words = shortTitle(book.title).split(" ");
      const fs = Math.max(6 * u, w * 0.12);
      ctx.font = `700 ${fs}px ${FONT_SPINE}`;
      const lines = [];
      for (const word of words) {
        const last = lines[lines.length - 1];
        if (last && ctx.measureText(last + " " + word).width < w - 14 * u) lines[lines.length - 1] = last + " " + word;
        else lines.push(word);
      }
      lines.slice(0, 5).forEach((ln, i, arr) => ctx.fillText(ln, x + w / 2, y + h * 0.45 + (i - (arr.length - 1) / 2) * fs * 1.25));
    }
    // Hinge, gloss and edge.
    const hg = ctx.createLinearGradient(x, 0, x + w * 0.12, 0);
    hg.addColorStop(0, "rgba(0,0,0,0.45)");
    hg.addColorStop(0.55, "rgba(255,255,255,0.18)");
    hg.addColorStop(0.7, "rgba(0,0,0,0.12)");
    hg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(x, y, w * 0.12, h);
    const gl = ctx.createLinearGradient(x, y, x + w, y + h);
    gl.addColorStop(0, "rgba(255,250,235,0.22)");
    gl.addColorStop(0.35, "rgba(255,250,235,0.04)");
    gl.addColorStop(0.36, "rgba(255,250,235,0)");
    gl.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    roundRect(x, y, w, h, radius);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 0.6 * u;
    ctx.stroke();
  }

  function ribbon(x, yTop, yEnd) {
    const w = 4.2 * u;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 3 * u;
    ctx.shadowOffsetX = 1.5 * u;
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x + w, yTop);
    ctx.bezierCurveTo(x + w + 0.6 * u, yTop + (yEnd - yTop) * 0.5, x + w - 0.6 * u, yEnd - 4 * u, x + w + 0.4 * u, yEnd);
    ctx.lineTo(x + w / 2 + 0.2 * u, yEnd - 2.6 * u);
    ctx.lineTo(x + 0.2 * u, yEnd);
    ctx.bezierCurveTo(x - 0.4 * u, yEnd - 4 * u, x + 0.6 * u, yTop + (yEnd - yTop) * 0.5, x, yTop);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#5e0815");
    g.addColorStop(0.35, "#d8314d");
    g.addColorStop(0.55, "#a3162d");
    g.addColorStop(1, "#4a0610");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function flatStack(x, baseY, w, key) {
    const r = seeded(key);
    let y = baseY;
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const t = (6.5 + r() * 3.5) * u;
      const bw = w - r() * 7 * u;
      const bx = x + r() * (w - bw);
      y -= t;
      const c = mix(LEATHER[Math.floor(r() * LEATHER.length)], [20, 8, 4], 0.25);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 4 * u;
      ctx.shadowOffsetX = 2 * u;
      ctx.fillStyle = rgba(c);
      roundRect(bx, y, bw, t, 1.2 * u);
      ctx.fill();
      ctx.restore();
      roundRect(bx, y, bw, t, 1.2 * u);
      const g = ctx.createLinearGradient(0, y, 0, y + t);
      g.addColorStop(0, "rgba(255,235,210,0.22)");
      g.addColorStop(0.4, "rgba(255,235,210,0.02)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = g;
      ctx.fill();
      texture(0.2);
      ctx.fillStyle = gold(bx, y, bx, y + t);
      for (const fx of [0.07, 0.12, 0.88, 0.93]) ctx.fillRect(bx + bw * fx, y + 0.8 * u, 0.7 * u, t - 1.6 * u);
      ctx.fillRect(bx + bw * 0.3, y + t / 2 - 0.3 * u, bw * 0.4, 0.6 * u);
    }
    return baseY - y;
  }

  // ---- decor -------------------------------------------------------------
  function candle(cx, baseY, h) {
    const brass = (x0, x1) => {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, "#5a3d10");
      g.addColorStop(0.35, "#f3d17c");
      g.addColorStop(0.55, "#b88a2e");
      g.addColorStop(1, "#4a300c");
      return g;
    };
    const dish = 8 * u, stemW = 2.2 * u;
    const candleH = h * 0.42, candleW = 5.2 * u;
    const stemTop = baseY - h * 0.5;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 5 * u;
    ctx.shadowOffsetX = 2 * u;
    ctx.fillStyle = brass(cx - dish, cx + dish);
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 1.6 * u, dish, 2 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = brass(cx - dish * 0.6, cx + dish * 0.6);
    ctx.beginPath();
    ctx.moveTo(cx - dish * 0.55, baseY - 2 * u);
    ctx.quadraticCurveTo(cx - stemW, baseY - 6 * u, cx - stemW / 2, baseY - 9 * u);
    ctx.lineTo(cx - stemW / 2, stemTop + 4 * u);
    ctx.lineTo(cx + stemW / 2, stemTop + 4 * u);
    ctx.lineTo(cx + stemW / 2, baseY - 9 * u);
    ctx.quadraticCurveTo(cx + stemW, baseY - 6 * u, cx + dish * 0.55, baseY - 2 * u);
    ctx.closePath();
    ctx.fill();
    for (const ky of [0.35, 0.7]) {
      ctx.fillStyle = brass(cx - 2.6 * u, cx + 2.6 * u);
      ctx.beginPath();
      ctx.ellipse(cx, baseY - 9 * u - (baseY - 9 * u - stemTop) * ky, 2.4 * u, 1.6 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = brass(cx - 6 * u, cx + 6 * u);
    ctx.beginPath();
    ctx.moveTo(cx - 6 * u, stemTop);
    ctx.quadraticCurveTo(cx, stemTop + 7 * u, cx + 6 * u, stemTop);
    ctx.closePath();
    ctx.fill();

    // Wax candle with drips.
    const cy = stemTop - candleH;
    const wax = ctx.createLinearGradient(cx - candleW / 2, 0, cx + candleW / 2, 0);
    wax.addColorStop(0, "#b9a27c");
    wax.addColorStop(0.4, "#fff4dc");
    wax.addColorStop(1, "#a88f68");
    ctx.fillStyle = wax;
    roundRect(cx - candleW / 2, cy, candleW, candleH, [1.2 * u, 1.2 * u, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#f6ead0";
    ctx.beginPath();
    ctx.ellipse(cx - candleW * 0.25, cy + candleH * 0.22, 0.9 * u, candleH * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a1a0a";
    ctx.lineWidth = 0.5 * u;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 0.2 * u, cy - 1.6 * u);
    ctx.stroke();

    // Flame and its light.
    const fy = cy - 1.6 * u;
    glow(cx, fy - 3 * u, 70 * u, [255, 170, 80], 0.32);
    glow(cx, fy - 3 * u, 16 * u, [255, 200, 120], 0.6);
    const fl = ctx.createRadialGradient(cx, fy - 1.6 * u, 0.2 * u, cx, fy - 2.5 * u, 5 * u);
    fl.addColorStop(0, "#ffffff");
    fl.addColorStop(0.3, "#fff1a8");
    fl.addColorStop(0.7, "#ffa632");
    fl.addColorStop(1, "rgba(255,90,20,0)");
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.moveTo(cx, fy - 8 * u);
    ctx.bezierCurveTo(cx + 1.4 * u, fy - 4.5 * u, cx + 2.6 * u, fy - 1 * u, cx, fy + 0.4 * u);
    ctx.bezierCurveTo(cx - 2.6 * u, fy - 1 * u, cx - 1.4 * u, fy - 4.5 * u, cx, fy - 8 * u);
    ctx.fill();
  }

  function rose(cx, baseY, jarH) {
    const jw = jarH * 0.46, padH = 5 * u;
    const yb = baseY - padH, yt = yb - jarH, r = jw / 2;
    const x0 = cx - r, x1 = cx + r;
    const bloomY = yt + jarH * 0.36, br = jw * 0.2;

    glow(cx, bloomY + jarH * 0.08, jarH * 1.05, [255, 70, 110], 0.28);

    // Pedestal.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 5 * u;
    ctx.shadowOffsetX = 2 * u;
    const pw = jw + 7 * u;
    const pg = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0);
    pg.addColorStop(0, "#1c0c05");
    pg.addColorStop(0.4, "#5a2f15");
    pg.addColorStop(1, "#160903");
    ctx.fillStyle = pg;
    roundRect(cx - pw / 2, baseY - padH, pw, padH, [1.5 * u, 1.5 * u, 1 * u, 1 * u]);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = gold(cx - pw / 2, 0, cx + pw / 2, 0);
    ctx.fillRect(cx - pw / 2 + 0.6 * u, baseY - padH + 0.4 * u, pw - 1.2 * u, 0.8 * u);
    ctx.fillRect(cx - pw / 2 + 0.6 * u, baseY - 1.4 * u, pw - 1.2 * u, 0.5 * u);

    // Stem and leaves.
    ctx.strokeStyle = "#3f6e2f";
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.moveTo(cx, bloomY + br * 0.6);
    ctx.bezierCurveTo(cx - 3 * u, bloomY + jarH * 0.25, cx + 3 * u, yb - jarH * 0.2, cx + 0.5 * u, yb - 0.5 * u);
    ctx.stroke();
    const leaf = (lx, ly, dir, s) => {
      const lg = ctx.createLinearGradient(lx, ly, lx + dir * 7 * s, ly - 4 * s);
      lg.addColorStop(0, "#26501f");
      lg.addColorStop(1, "#5f9a45");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.quadraticCurveTo(lx + dir * 3 * s, ly - 6 * s, lx + dir * 8 * s, ly - 4 * s);
      ctx.quadraticCurveTo(lx + dir * 4 * s, ly + 1.5 * s, lx, ly);
      ctx.fill();
    };
    leaf(cx - 1 * u, bloomY + jarH * 0.3, -1, u * jarH / 52);
    leaf(cx + 1 * u, bloomY + jarH * 0.44, 1, u * jarH / 52);

    // Bloom: layered petals.
    ctx.save();
    ctx.shadowColor = "rgba(255,40,80,0.9)";
    ctx.shadowBlur = 8 * u;
    const petal = (ang, dist, pr, c0, c1) => {
      const px = cx + Math.cos(ang) * dist, py = bloomY + Math.sin(ang) * dist * 0.75;
      const pg2 = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.4, pr * 0.1, px, py, pr);
      pg2.addColorStop(0, c0);
      pg2.addColorStop(1, c1);
      ctx.fillStyle = pg2;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.82, ang * 0.3, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let i = 0; i < 6; i++) petal(Math.PI * (0.15 + i / 3), br * 0.62, br * 0.62, "#e0304f", "#7d0820");
    ctx.shadowBlur = 0;
    for (let i = 0; i < 4; i++) petal(Math.PI * (0.4 + i / 2), br * 0.32, br * 0.5, "#ff5a73", "#a3102c");
    petal(0, 0, br * 0.4, "#ff7a8e", "#b4142f");
    ctx.restore();
    ctx.strokeStyle = "rgba(90,0,20,0.8)";
    ctx.lineWidth = 0.5 * u;
    ctx.beginPath();
    ctx.arc(cx, bloomY, br * 0.22, Math.PI * 0.1, Math.PI * 1.6);
    ctx.stroke();

    // Fallen petals.
    for (const [dx, a] of [[0.35, 0.2], [-0.42, -0.3]]) {
      ctx.fillStyle = "#b3172f";
      ctx.beginPath();
      ctx.ellipse(cx + jw * dx, yb - 1 * u, 2 * u, 0.9 * u, a, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glass dome.
    const k = 0.5523;
    const domePath = () => {
      ctx.beginPath();
      ctx.moveTo(x0, yb);
      ctx.lineTo(x0, yt + r);
      ctx.bezierCurveTo(x0, yt + r - k * r, cx - k * r, yt, cx, yt);
      ctx.bezierCurveTo(cx + k * r, yt, x1, yt + r - k * r, x1, yt + r);
      ctx.lineTo(x1, yb);
      ctx.closePath();
    };
    domePath();
    const glass = ctx.createLinearGradient(x0, 0, x1, 0);
    glass.addColorStop(0, "rgba(255,240,230,0.26)");
    glass.addColorStop(0.18, "rgba(255,240,230,0.05)");
    glass.addColorStop(0.75, "rgba(255,240,230,0.03)");
    glass.addColorStop(1, "rgba(255,240,230,0.2)");
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,238,225,0.55)";
    ctx.lineWidth = 0.7 * u;
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 3 * u;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1.2 * u;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0 + jw * 0.14, yb - jarH * 0.15);
    ctx.lineTo(x0 + jw * 0.14, yt + r * 1.05);
    ctx.quadraticCurveTo(x0 + jw * 0.17, yt + r * 0.35, cx - r * 0.2, yt + r * 0.18);
    ctx.stroke();
    ctx.lineWidth = 0.7 * u;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x1 - jw * 0.12, yt + r * 1.2);
    ctx.lineTo(x1 - jw * 0.12, yb - jarH * 0.3);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = gold(cx - 2 * u, 0, cx + 2 * u, 0);
    ctx.beginPath();
    ctx.ellipse(cx, yt - 1.2 * u, 1.8 * u, 1.6 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    const sr = seeded("sparkles");
    for (let i = 0; i < 9; i++) {
      const sx = x0 + jw * 0.15 + sr() * jw * 0.7;
      const sy = yt + jarH * 0.12 + sr() * jarH * 0.75;
      sparkle(sx, sy, (0.7 + sr() * 1.1) * u, i % 2 ? [255, 160, 190] : [255, 214, 120]);
    }
  }

  // ---- frame -------------------------------------------------------------
  function rosette(x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.3);
    g.addColorStop(0, "#fff0b5");
    g.addColorStop(0.5, "#d4a640");
    g.addColorStop(1, "#5e3f0e");
    ctx.fillStyle = g;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, r * 0.32, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  function scroll(x, y, dir, len) {
    // A gilded flourish: a line ending in a curl.
    ctx.save();
    ctx.strokeStyle = gold(x, y - 4 * u, x + dir * len, y + 4 * u);
    ctx.lineWidth = 1 * u;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + dir * len * 0.3, y - 3 * u, x + dir * len * 0.6, y + 3 * u, x + dir * len * 0.85, y);
    ctx.bezierCurveTo(x + dir * len * 0.95, y - 2 * u, x + dir * len, y - 5 * u, x + dir * (len - 4 * u), y - 5 * u);
    ctx.bezierCurveTo(x + dir * (len - 7 * u), y - 5 * u, x + dir * (len - 7 * u), y - 1.5 * u, x + dir * (len - 4.5 * u), y - 1.8 * u);
    ctx.stroke();
    ctx.restore();
  }

  function frame() {
    const archY = band + rise;
    const cx = W / 2;
    const k = 0.5523;

    // Shadows the frame casts into the case.
    for (const [x0, x1] of [[innerL, innerL + 14 * u], [innerR, innerR - 14 * u]]) {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, "rgba(0,0,0,0.6)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(x0, x1), 0, 14 * u, H);
    }

    // Pillars, turned like columns.
    for (const x of [0, W - f]) {
      const g = ctx.createLinearGradient(x, 0, x + f, 0);
      g.addColorStop(0, "#120602");
      g.addColorStop(0.3, "#4d2812");
      g.addColorStop(0.5, "#3a1d0c");
      g.addColorStop(0.8, "#24110a");
      g.addColorStop(1, "#0d0401");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.rect(x, 0, f, H);
      ctx.fill();
      texture(0.18);
      grain(x, 0, f, H, true, 5, 0.18);
      for (const fx of [0.32, 0.68]) {
        ctx.fillStyle = gold(x + f * fx - u, 0, x + f * fx + u, 0, 0.85);
        ctx.fillRect(x + f * fx - 0.45 * u, archY + 6 * u, 0.9 * u, H - archY - baseH - 12 * u);
      }
    }

    // Crown with an arched opening.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, archY);
    ctx.lineTo(innerR, archY);
    ctx.bezierCurveTo(innerR, archY - k * rise, cx + k * (cx - innerL), band, cx, band);
    ctx.bezierCurveTo(cx - k * (cx - innerL), band, innerL, archY - k * rise, innerL, archY);
    ctx.lineTo(0, archY);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, 0, 0, archY);
    cg.addColorStop(0, "#1b0b04");
    cg.addColorStop(0.5, "#3b1d0c");
    cg.addColorStop(1, "#24110a");
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8 * u;
    ctx.shadowOffsetY = 3 * u;
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.restore();
    texture(0.18);

    // Gilded molding following the arch.
    const arch = off => {
      ctx.beginPath();
      ctx.moveTo(innerR - off, archY + 1 * u);
      ctx.lineTo(innerR - off, archY);
      ctx.bezierCurveTo(innerR - off, archY - k * (rise - off), cx + k * (cx - innerL - off), band + off, cx, band + off);
      ctx.bezierCurveTo(cx - k * (cx - innerL - off), band + off, innerL + off, archY - k * (rise - off), innerL + off, archY);
      ctx.lineTo(innerL + off, archY + 1 * u);
    };
    arch(0.8 * u);
    ctx.strokeStyle = gold(0, band, 0, archY + 2 * u);
    ctx.lineWidth = 1.6 * u;
    ctx.stroke();
    arch(3.6 * u);
    ctx.strokeStyle = gold(0, band, 0, archY, 0.55);
    ctx.lineWidth = 0.6 * u;
    ctx.stroke();

    // Cornice along the very top, with a bead row.
    const cornice = ctx.createLinearGradient(0, 0, 0, 5 * u);
    cornice.addColorStop(0, "#0c0401");
    cornice.addColorStop(1, "#2c150a");
    ctx.fillStyle = cornice;
    ctx.fillRect(0, 0, W, 4 * u);
    ctx.fillStyle = gold(0, 4 * u, 0, 6 * u);
    ctx.fillRect(0, 4 * u, W, 1 * u);
    if (L.title) {
      for (let bx = f + 3 * u; bx < W - f; bx += 6 * u) {
        ctx.fillStyle = gold(bx - u, 7 * u, bx + u, 9 * u, 0.8);
        ctx.beginPath();
        ctx.ellipse(bx, 8 * u, 1.1 * u, 1.4 * u, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Keystone and spandrel ornaments.
    rosette(cx, band + 1 * u, 3.2 * u);
    if (rise >= 14 * u) {
      rosette(innerL + rise * 0.75, band + rise * 0.28, 1.9 * u);
      rosette(innerR - rise * 0.75, band + rise * 0.28, 1.9 * u);
    }

    if (L.title && cfg.libraryName) {
      const fs = 26 * u;
      const ty = band * 0.6;
      ctx.font = `${fs}px ${FONT_SCRIPT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(cfg.libraryName).width;
      glow(cx, ty, tw * 0.8, [255, 200, 120], 0.12);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 2 * u;
      ctx.shadowOffsetY = 1.2 * u;
      ctx.fillStyle = gold(0, ty - fs * 0.5, 0, ty + fs * 0.4);
      ctx.fillText(cfg.libraryName, cx, ty);
      ctx.restore();
      const len = Math.min(70 * u, (W - tw) / 2 - f - 14 * u);
      if (len > 20 * u) {
        scroll(cx - tw / 2 - 8 * u, ty + 3 * u, -1, len);
        scroll(cx + tw / 2 + 8 * u, ty + 3 * u, 1, len);
      }
    }

    // Plinth.
    const by = H - baseH;
    const pg = ctx.createLinearGradient(0, by, 0, H);
    pg.addColorStop(0, "#3d1e0d");
    pg.addColorStop(1, "#0d0502");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.rect(0, by, W, baseH);
    ctx.fill();
    texture(0.15);
    ctx.fillStyle = gold(0, by, 0, by + 1.5 * u);
    ctx.fillRect(0, by, W, 1.2 * u);
  }

  function plankTopSurface(y) {
    const g = ctx.createLinearGradient(0, y - 4 * u, 0, y);
    g.addColorStop(0, "#2a1408");
    g.addColorStop(1, "#7b4623");
    ctx.fillStyle = g;
    ctx.fillRect(innerL, y - 4 * u, innerW, 4 * u);
  }

  function plankFront(y) {
    const g = ctx.createLinearGradient(0, y, 0, y + plank);
    g.addColorStop(0, "#6a3a1c");
    g.addColorStop(0.5, "#4a2511");
    g.addColorStop(1, "#241006");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.rect(innerL, y, innerW, plank);
    ctx.fill();
    texture(0.15);
    grain(innerL, y + 1.5 * u, innerW, plank - 2 * u, false, 4, 0.2);
    ctx.fillStyle = gold(0, y, 0, y + 1.6 * u);
    ctx.fillRect(innerL, y + 0.3 * u, innerW, 1.1 * u);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(innerL, y + plank - 0.8 * u, innerW, 0.8 * u);
  }

  // ---- composition -------------------------------------------------------
  backWall();

  const covers = scene.covers.slice();
  const spines = scene.spines.map(b => ({ ...b, color: leatherFrom(b.img, b.id + b.title) }));
  const ribbons = [];
  const lastShelf = L.shelves - 1;

  for (let s = 0; s < L.shelves; s++) {
    const slotTop = top + s * slotH;
    const plankY = slotTop + slotH - plank;
    const baseY = plankY - 1 * u;
    const maxH = baseY - slotTop - 7 * u;

    // Shadow under the shelf above (or the crown).
    const sg = ctx.createLinearGradient(0, slotTop, 0, slotTop + 18 * u);
    sg.addColorStop(0, "rgba(0,0,0,0.6)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(innerL, slotTop, innerW, 18 * u);

    plankTopSurface(plankY);

    let x = innerL + 6 * u;
    let limit = innerR - 5 * u;
    const decor = [];
    const roseH = Math.min(maxH * 0.68, 78 * u);
    if (cfg.showRose && s === lastShelf && scene.family !== "small") {
      const rw = roseH * 0.46 + 8 * u;
      const rx = limit - rw / 2;
      decor.push(() => rose(rx, baseY, roseH));
      limit -= rw + 6 * u;
    }
    if (cfg.showCandle && s === 0 && scene.family !== "small" && (L.shelves > 1 || scene.family === "medium")) {
      const cx = limit - 9 * u;
      decor.push(() => candle(cx, baseY, Math.min(maxH * 0.62, 70 * u)));
      limit -= 20 * u;
    }

    if (s === 0) {
      while (covers.length) {
        const b = covers[0];
        const h = maxH * 0.86;
        const ratio = b.img ? clamp(b.img.width / b.img.height, 0.6, 0.75) : 0.66;
        const w = h * ratio;
        if (x + w + 3 * u > limit) break;
        covers.shift();
        cover(x, baseY, w, h, b);
        ribbons.push(x + w * 0.68);
        x += w + 6 * u;
      }
    }

    while (spines.length) {
      const b = spines[0];
      const r = seeded(b.id + "size");
      const w = (15 + r() * 7) * u;
      if (x + w > limit) break;
      spines.shift();
      spine(x, baseY, w, maxH * (0.84 + r() * 0.15), b.color, b.title, b.id, false);
      x += w + 0.4 * u;
    }

    let gap = limit - x;
    if (cfg.fillEmptySpace && gap > 6 * u) {
      x += 4 * u;
      gap -= 4 * u;
      const stackW = (38 + rng() * 8) * u;
      const stackFirst = gap > stackW + 20 * u && rng() < 0.5;
      if (stackFirst) {
        flatStack(x, baseY, stackW, "stack" + s);
        x += stackW + 5 * u;
      }
      while (true) {
        const w = (8 + rng() * 8) * u;
        const reserve = !stackFirst && gap > stackW + 30 * u ? stackW + 6 * u : 0;
        if (x + w > limit - reserve) break;
        const c = mix(LEATHER[Math.floor(rng() * LEATHER.length)], [24, 10, 4], 0.35);
        spine(x, baseY, w, maxH * (0.7 + rng() * 0.25), c, "", "filler" + s + x, true);
        x += w + 0.4 * u;
      }
      if (!stackFirst && limit - x >= stackW + 4 * u) flatStack(x + 4 * u, baseY, stackW, "stack" + s);
    }

    decor.forEach(d => d());
    plankFront(plankY);
    for (const rx of ribbons.splice(0)) ribbon(rx, baseY - 3 * u, plankY + plank + 5 * u);
  }

  frame();

  // Candle-warm glow and a soft vignette.
  glow(W / 2, top + (H - top) * 0.25, Math.max(W, H) * 0.7, [255, 180, 110], 0.1);
  const v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  if (scene.note) {
    const w = Math.min(W - 30 * u, 170 * u), h = 36 * u;
    const nx = (W - w) / 2, ny = H / 2 - h / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10 * u;
    const pg = ctx.createLinearGradient(0, ny, 0, ny + h);
    pg.addColorStop(0, "#f4e7c8");
    pg.addColorStop(1, "#dcc79b");
    ctx.fillStyle = pg;
    roundRect(nx, ny, w, h, 3 * u);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#3a2208";
    ctx.font = `italic 600 ${11 * u}px ${FONT_ITALIC}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    scene.note.split("\n").forEach((line, i, arr) => ctx.fillText(line, W / 2, H / 2 + (i - (arr.length - 1) / 2) * 12 * u));
  }
}
// </renderer>

await main();
Script.complete();
