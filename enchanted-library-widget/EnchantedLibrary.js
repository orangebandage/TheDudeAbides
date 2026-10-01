// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-brown; icon-glyph: book-open;

// Enchanted Library — a Goodreads bookshelf widget for Scriptable.
//
// Draws a dark-wood library bookcase in the spirit of the Beast's library:
// an arched, gold-trimmed crown, leather-bound spines with gilt lettering,
// candle-lit glow, and the enchanted rose under its glass bell jar.
//
//   • "Currently reading" books stand face-out, marked with a red ribbon.
//   • "Favorites" stand as leather spines with their titles in gold.
//
// Works in small, medium and large home-screen widgets.
// Your Goodreads profile (or at least these shelves) must be public, because
// the widget reads Goodreads' public RSS feeds (their API is retired).

const CONFIG = {
  goodreadsUserId: "183463841",
  readingShelf: "currently-reading", // shown face-out with a ribbon bookmark
  spineShelf: "favorites",           // shown as leather spines
  libraryName: "My Library",         // engraved on the large widget's crown ("" to hide)
  fillEmptySpace: true,              // pad shelves with untitled antique volumes
  showRose: true,                    // the enchanted rose under glass
  refreshHours: 3,
};

// ---------------------------------------------------------------------------
// Palette

const WOOD = {
  wallTop: "#2b150b",
  wallBottom: "#120703",
  frame: "#2a1309",
  frameDark: "#170a04",
  frameLight: "#5a2f17",
  plankTop: "#7a4524",
  plankFront: "#4f2812",
  plankFrontDark: "#2c1408",
};
const GOLD = { base: "#c9a13b", hi: "#f2d47c", lo: "#7d5d1c" };
const LEATHER = [
  "#6b1a1f", "#7a2030", "#1f4a35", "#2c5530", "#1d2c4f", "#2b3a6b",
  "#4a2545", "#8a4b22", "#a0703c", "#5a3520", "#1f4f52", "#8c6d24", "#231c1a",
];
const RIBBON = "#a3162d";
const CANDLE = "#ffbf69";

// ---------------------------------------------------------------------------
// Entry point

const FM = FileManager.local();
const CACHE_DIR = FM.joinPath(FM.documentsDirectory(), "enchanted-library");
if (!FM.fileExists(CACHE_DIR)) FM.createDirectory(CACHE_DIR, true);

const PROFILE_URL = `https://www.goodreads.com/user/show/${CONFIG.goodreadsUserId}`;

async function main() {
  let family = config.widgetFamily;
  if (!config.runsInWidget) {
    family = await choosePreview();
    if (!family) return;
  }

  const library = await loadLibrary();
  const widget = family && family.startsWith("accessory")
    ? buildAccessoryWidget(family, library)
    : await buildWidget(family || "medium", library);

  widget.url = PROFILE_URL;
  widget.refreshAfterDate = new Date(Date.now() + CONFIG.refreshHours * 3600 * 1000);

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else if (family === "small") {
    await widget.presentSmall();
  } else if (family === "large") {
    await widget.presentLarge();
  } else {
    await widget.presentMedium();
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
      return {
        id: get("book_id") || get("guid"),
        title: get("title"),
        author: get("author_name"),
        cover: bestCoverUrl(
          get("book_large_image_url") || get("book_medium_image_url") || get("book_image_url")
        ),
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

async function loadCover(book) {
  if (!book.cover) return null;
  const path = FM.joinPath(CACHE_DIR, `cover-${String(book.id).replace(/\W/g, "")}.img`);
  if (FM.fileExists(path)) {
    const img = FM.readImage(path);
    if (img) return img;
  }
  try {
    const img = await new Request(book.cover).loadImage();
    FM.writeImage(path, img);
    return img;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lock-screen widgets (bonus: just text)

function buildAccessoryWidget(family, library) {
  const w = new ListWidget();
  const book = library.reading[0] || library.spines[0];
  if (family === "accessoryRectangular") {
    const head = w.addText(library.reading[0] ? "NOW READING" : "FAVORITE");
    head.font = Font.semiboldSystemFont(10);
    const t = w.addText(book ? shortTitle(book.title) : "No books yet");
    t.font = Font.boldSystemFont(14);
    t.lineLimit = 2;
    if (book && book.author) {
      const a = w.addText(book.author);
      a.font = Font.systemFont(11);
      a.lineLimit = 1;
    }
  } else {
    const t = w.addText(book ? shortTitle(book.title) : "📚");
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
  if (family === "small") return new Size(small, small);
  if (family === "large" || family === "extraLarge") return new Size(wide, Math.round(wide * 1.05));
  return new Size(wide, small);
}

const LAYOUTS = {
  // unitW: widget width that equals 100% scale; covers: max face-out books.
  small:  { unitW: 170, shelves: 2, covers: 1, band: 7,  rise: 10, plank: 6,  title: false, plaque: false },
  medium: { unitW: 364, shelves: 2, covers: 2, band: 6,  rise: 10, plank: 7,  title: false, plaque: false },
  large:  { unitW: 330, shelves: 3, covers: 3, band: 30, rise: 16, plank: 10, title: true,  plaque: true },
};

async function buildWidget(family, library) {
  const size = widgetSize(family);
  const L = LAYOUTS[family] || (family === "extraLarge" ? LAYOUTS.large : LAYOUTS.medium);

  const seen = new Set();
  const unique = books => books.filter(b => !seen.has(b.id) && seen.add(b.id));
  const reading = unique(library.reading);
  const faceOut = reading.slice(0, L.covers);
  const spines = reading.slice(L.covers).concat(unique(library.spines));

  const covers = [];
  for (const book of faceOut) covers.push({ book, image: await loadCover(book) });

  const w = new ListWidget();
  w.setPadding(0, 0, 0, 0);
  w.backgroundColor = new Color(WOOD.wallBottom);
  w.backgroundImage = drawLibrary(size, L, covers, spines, library);
  return w;
}

function drawLibrary(size, L, covers, spines, library) {
  const W = size.width, H = size.height;
  const u = W / L.unitW;
  const f = Math.round(Math.max(7, Math.min(11, Math.min(W, H) * 0.045)));
  const band = L.band * u, rise = L.rise * u, plank = L.plank * u;
  const baseH = f + 2 * u;
  const top = band + rise;
  const slotH = (H - baseH - top) / L.shelves;
  const left = f, right = W - f, iw = right - left;
  const rng = seeded("library" + W + "x" + H);

  const ctx = new DrawContext();
  ctx.size = size;
  ctx.opaque = true;
  ctx.respectScreenScale = true;

  // Back wall: dark paneling lit by candles.
  vGradient(ctx, new Rect(0, 0, W, H), WOOD.wallTop, WOOD.wallBottom);
  const panels = Math.max(2, Math.round(iw / (70 * u)));
  for (let i = 1; i < panels; i++) {
    const x = left + (iw * i) / panels;
    ctx.setFillColor(new Color("#000000", 0.35));
    ctx.fillRect(new Rect(x, 0, 1.2 * u, H));
    ctx.setFillColor(new Color("#ffffff", 0.04));
    ctx.fillRect(new Rect(x + 1.2 * u, 0, 0.8 * u, H));
  }
  grain(ctx, new Rect(left, top, iw, H - top - baseH), rng, u, true, Math.round(iw / (6 * u)), 0.05);
  glow(ctx, W / 2, top + (H - top) * 0.3, iw * 0.75, (H - top) * 0.8, CANDLE, 0.018, 18);

  // Shelves, top to bottom.
  const ribbons = [];
  let queue = spines.slice();
  let plaqueAt = null;
  for (let s = 0; s < L.shelves; s++) {
    const slotTop = top + s * slotH;
    const plankTop = slotTop + slotH - plank;
    const baseY = plankTop - 0.8 * u;
    const maxH = baseY - slotTop - 4 * u;
    const isLast = s === L.shelves - 1;

    // Shadow cast by the shelf above (or the crown).
    for (let i = 0; i < 8; i++) {
      ctx.setFillColor(new Color("#000000", 0.07 * (1 - i / 8)));
      ctx.fillRect(new Rect(left, slotTop + i * u, iw, u));
    }

    // Top surface of the plank, behind the books.
    ctx.setFillColor(new Color(WOOD.plankTop));
    ctx.fillRect(new Rect(left, plankTop - 2.5 * u, iw, 2.5 * u));
    ctx.setFillColor(new Color("#000000", 0.25));
    ctx.fillRect(new Rect(left, plankTop - 2.5 * u, iw, 0.6 * u));

    let x = left + 5 * u;
    let limit = right - 5 * u;
    const roseW = 30 * u;
    const hasRose = CONFIG.showRose && isLast && maxH >= 40 * u;
    if (hasRose) limit -= roseW + 4 * u;

    // Face-out covers on the top shelf.
    if (s === 0) {
      for (const c of covers) {
        const h = maxH * 0.96;
        let ratio = c.image ? c.image.size.width / c.image.size.height : 0.66;
        ratio = Math.max(0.55, Math.min(0.8, ratio));
        const cw = h * ratio;
        if (x + cw > limit) break;
        drawCover(ctx, x, baseY, cw, h, c, u);
        ribbons.push({ x: x + cw * 0.72, y: baseY, len: plank + 6 * u });
        x += cw + 3 * u;
      }
      if (covers.length) x += 2 * u;
    }

    // Leather spines for the user's books.
    const spinesFrom = x;
    while (queue.length) {
      const book = queue[0];
      const r = seeded(book.id + book.title);
      const sw = Math.round((13 + r() * 6) * u);
      if (x + sw > limit) break;
      queue.shift();
      const h = maxH * (0.8 + r() * 0.17);
      drawSpine(ctx, x, baseY, sw, h, pick(LEATHER, r), spineTitle(book.title), u, r, false);
      x += sw + 0.6 * u;
    }
    if (x > spinesFrom && !plaqueAt) plaqueAt = { s, cx: (spinesFrom + x) / 2 };

    // Antique filler volumes so the case looks full.
    if (CONFIG.fillEmptySpace) {
      let stacked = false;
      x += 2 * u;
      while (true) {
        const room = limit - x;
        const stackW = (34 + rng() * 10) * u;
        if (!stacked && room >= stackW && rng() < 0.35) {
          drawFlatStack(ctx, x, baseY, stackW, u, rng);
          x += stackW + 2 * u;
          stacked = true;
          continue;
        }
        const sw = (7 + rng() * 7) * u;
        if (sw > room) break;
        const h = maxH * (0.68 + rng() * 0.27);
        drawSpine(ctx, x, baseY, sw, h, mix(pick(LEATHER, rng), "#000000", 0.35), "", u, rng, true);
        x += sw + 0.6 * u;
      }
    }

    if (hasRose) drawRose(ctx, right - 5 * u - roseW / 2, baseY, u);

    drawPlank(ctx, left, plankTop, iw, plank, u, rng);

    if (L.plaque && plaqueAt && plaqueAt.s === s) drawPlaque(ctx, plaqueAt.cx, plankTop, plank, "Favorites", u);
  }

  for (const r of ribbons) drawRibbon(ctx, r.x, r.y, r.len, u);

  // Vignette toward the edges of the case.
  for (let i = 0; i < 10; i++) {
    ctx.setStrokeColor(new Color("#000000", 0.05));
    ctx.setLineWidth(2 * u);
    ctx.strokeRect(new Rect(left + i * 2 * u, top + i * 2 * u, iw - i * 4 * u, H - top - baseH - i * 4 * u));
  }

  drawFrame(ctx, W, H, f, band, rise, baseH, u, rng, L.title ? CONFIG.libraryName : "");

  if (library.error && !covers.length && !spines.length) {
    drawNote(ctx, W, H, u, "Couldn't reach Goodreads.\nIs your profile public?");
  } else if (!covers.length && !spines.length) {
    drawNote(ctx, W, H, u, `No books on “${CONFIG.readingShelf}”\nor “${CONFIG.spineShelf}” yet.`);
  }

  return ctx.getImage();
}

// ---------------------------------------------------------------------------
// Pieces of furniture

function drawFrame(ctx, W, H, f, band, rise, baseH, u, rng, title) {
  const cx = W / 2;

  // Pillars.
  for (const x of [0, W - f]) {
    ctx.setFillColor(new Color(WOOD.frame));
    ctx.fillRect(new Rect(x, 0, f, H));
    grain(ctx, new Rect(x + 0.5 * u, 0, f - u, H), rng, u, true, 4, 0.12);
    const inner = x === 0 ? f - 1.2 * u : x;
    ctx.setFillColor(new Color(WOOD.frameLight, 0.8));
    ctx.fillRect(new Rect(inner, 0, 1.2 * u, H));
    goldLine(ctx, [new Point(x + f / 2, band + 2 * u), new Point(x + f / 2, H - baseH - 2 * u)], u * 0.8);
  }

  // Crown with an arched opening.
  const k = 0.5523;
  const archL = f, archR = W - f, archY = band + rise;
  const crown = new Path();
  crown.move(new Point(0, 0));
  crown.addLine(new Point(W, 0));
  crown.addLine(new Point(W, archY));
  crown.addLine(new Point(archR, archY));
  crown.addCurve(new Point(cx, band), new Point(archR, archY - k * rise), new Point(cx + k * (cx - archL), band));
  crown.addCurve(new Point(archL, archY), new Point(cx - k * (cx - archL), band), new Point(archL, archY - k * rise));
  crown.addLine(new Point(0, archY));
  crown.closeSubpath();
  ctx.addPath(crown);
  ctx.setFillColor(new Color(WOOD.frame));
  ctx.fillPath();
  grain(ctx, new Rect(0, 0.5 * u, W, Math.max(2 * u, band - u)), rng, u, false, Math.round(band / (2.5 * u)) + 1, 0.12);

  // Gold molding following the arch, twice.
  for (const [off, a] of [[0, 1], [2.6 * u, 0.55]]) {
    const p = new Path();
    p.move(new Point(archR - off, archY));
    p.addCurve(new Point(cx, band + off), new Point(archR - off, archY - k * rise), new Point(cx + k * (cx - archL), band + off));
    p.addCurve(new Point(archL + off, archY), new Point(cx - k * (cx - archL), band + off), new Point(archL + off, archY - k * rise));
    ctx.addPath(p);
    ctx.setStrokeColor(new Color(GOLD.base, a));
    ctx.setLineWidth(off ? 0.6 * u : 1.3 * u);
    ctx.strokePath();
  }
  // Keystone rosette.
  rosette(ctx, cx, band + 0.5 * u, 2.6 * u);
  // Spandrel ornaments.
  if (rise >= 12 * u) {
    rosette(ctx, archL + rise * 0.9, band + rise * 0.32, 1.8 * u);
    rosette(ctx, archR - rise * 0.9, band + rise * 0.32, 1.8 * u);
  }

  // Top cornice.
  ctx.setFillColor(new Color(WOOD.frameDark));
  ctx.fillRect(new Rect(0, 0, W, 1.5 * u));
  goldLine(ctx, [new Point(0, 2.2 * u), new Point(W, 2.2 * u)], 0.7 * u);

  if (title) {
    const fs = 15 * u;
    ctx.setFont(new Font("SnellRoundhand-Bold", fs));
    ctx.setTextAlignedCenter();
    ctx.setTextColor(new Color("#000000", 0.6));
    ctx.drawTextInRect(title, new Rect(0, band / 2 - fs * 0.62 + 0.8 * u, W, fs * 1.6));
    ctx.setTextColor(new Color(GOLD.hi));
    ctx.drawTextInRect(title, new Rect(0, band / 2 - fs * 0.62, W, fs * 1.6));
    const tw = title.length * fs * 0.42;
    const y = band / 2 + 1.5 * u;
    for (const dir of [-1, 1]) {
      const a = cx + dir * (tw / 2 + 8 * u), b = cx + dir * (W * 0.38);
      goldLine(ctx, [new Point(a, y), new Point(b, y)], 0.7 * u);
      rosette(ctx, b + dir * 2.5 * u, y, 1.4 * u);
    }
  }

  // Plinth.
  const by = H - baseH;
  ctx.setFillColor(new Color(WOOD.frame));
  ctx.fillRect(new Rect(0, by, W, baseH));
  grain(ctx, new Rect(0, by + 1.5 * u, W, baseH - 2 * u), rng, u, false, 3, 0.12);
  goldLine(ctx, [new Point(0, by + 0.7 * u), new Point(W, by + 0.7 * u)], 0.9 * u);
  ctx.setFillColor(new Color(WOOD.frameDark));
  ctx.fillRect(new Rect(0, H - 2 * u, W, 2 * u));
}

function drawPlank(ctx, x, y, w, h, u, rng) {
  vGradient(ctx, new Rect(x, y, w, h), WOOD.plankFront, WOOD.plankFrontDark, 8);
  grain(ctx, new Rect(x, y + 1.5 * u, w, h - 2.5 * u), rng, u, false, 2, 0.12);
  goldLine(ctx, [new Point(x, y + 0.5 * u), new Point(x + w, y + 0.5 * u)], 0.8 * u);
  ctx.setFillColor(new Color("#000000", 0.5));
  ctx.fillRect(new Rect(x, y + h - 0.8 * u, w, 0.8 * u));
}

function drawSpine(ctx, x, baseY, w, h, color, title, u, rng, filler) {
  const y = baseY - h;
  // Shadow on the wall behind.
  ctx.setFillColor(new Color("#000000", 0.3));
  ctx.fillRect(new Rect(x + w * 0.4, y + 2 * u, w * 0.6 + 2 * u, h - 2 * u));

  ctx.setFillColor(new Color(color));
  ctx.fillRect(new Rect(x, y, w, h));
  // Rounded-spine shading.
  const shades = [[0, 0.1, "#ffffff", 0.14], [0.1, 0.28, "#ffffff", 0.06], [0.68, 0.86, "#000000", 0.16], [0.86, 1, "#000000", 0.32]];
  for (const [a, b, c, alpha] of shades) {
    ctx.setFillColor(new Color(c, alpha));
    ctx.fillRect(new Rect(x + w * a, y, w * (b - a), h));
  }
  ctx.setFillColor(new Color("#000000", 0.35));
  ctx.fillRect(new Rect(x, y, w, 0.8 * u));

  // Raised gilt bands.
  const bandA = filler ? 0.6 : 0.95;
  for (const t of [0.06, 0.1, 0.9, 0.94]) {
    ctx.setFillColor(new Color(GOLD.base, bandA));
    ctx.fillRect(new Rect(x + 0.5 * u, y + h * t, w - u, 0.8 * u));
  }
  if (filler) {
    if (rng() < 0.5) {
      ctx.setFillColor(new Color(GOLD.lo, 0.7));
      ctx.fillRect(new Rect(x + w * 0.3, y + h * 0.45, w * 0.4, 0.8 * u));
      ctx.fillRect(new Rect(x + w * 0.3, y + h * 0.55, w * 0.4, 0.8 * u));
    }
    return;
  }

  const textTop = y + h * 0.15, textBottom = y + h * 0.85;
  // Some volumes carry a darker title label.
  if (rng() < 0.4) {
    ctx.setFillColor(new Color(mix(color, "#000000", 0.45)));
    ctx.fillRect(new Rect(x + 1.2 * u, textTop - u, w - 2.4 * u, textBottom - textTop + 2 * u));
    ctx.setStrokeColor(new Color(GOLD.base, 0.8));
    ctx.setLineWidth(0.5 * u);
    ctx.strokeRect(new Rect(x + 1.2 * u, textTop - u, w - 2.4 * u, textBottom - textTop + 2 * u));
  }

  // Title in gilt letters stacked down the spine, shrinking a little so the
  // first word fits when possible.
  const region = textBottom - textTop;
  const word = (title.length > 8 ? title.replace(/^(THE|A|AN) /, "") : title).split(" ")[0];
  const fit = region / (Math.min(word.length, 8) * 1.02);
  const fs = Math.min(w * 0.56, Math.max(fit, w * 0.4));
  const lh = fs * 1.02;
  const max = Math.floor(region / lh + 0.01);
  const letters = fitLetters(title, max);
  const ty = (textTop + textBottom) / 2 - (letters.length * lh) / 2 - fs * 0.22;
  ctx.setFont(new Font("Baskerville-Bold", fs));
  ctx.setTextAlignedCenter();
  letters.forEach((ch, i) => {
    const r = new Rect(x - 2 * u, ty + i * lh, w + 4 * u, fs * 1.7);
    ctx.setTextColor(new Color("#000000", 0.5));
    ctx.drawTextInRect(ch, new Rect(r.x + 0.4 * u, r.y + 0.4 * u, r.width, r.height));
    ctx.setTextColor(new Color(GOLD.hi));
    ctx.drawTextInRect(ch, r);
  });
}

function drawFlatStack(ctx, x, baseY, w, u, rng) {
  let y = baseY;
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const t = (5 + rng() * 3) * u;
    const bw = w - rng() * 6 * u;
    const bx = x + rng() * (w - bw);
    y -= t;
    const c = mix(pick(LEATHER, rng), "#000000", 0.25);
    ctx.setFillColor(new Color("#000000", 0.3));
    ctx.fillRect(new Rect(bx + 2 * u, y + u, bw, t));
    ctx.setFillColor(new Color(c));
    ctx.fillRect(new Rect(bx, y, bw, t));
    ctx.setFillColor(new Color("#ffffff", 0.1));
    ctx.fillRect(new Rect(bx, y, bw, t * 0.3));
    ctx.setFillColor(new Color("#000000", 0.3));
    ctx.fillRect(new Rect(bx, y + t * 0.75, bw, t * 0.25));
    ctx.setFillColor(new Color(GOLD.base, 0.8));
    for (const fx of [0.08, 0.14, 0.86, 0.92]) ctx.fillRect(new Rect(bx + bw * fx, y + 0.5 * u, 0.8 * u, t - u));
  }
}

function drawCover(ctx, x, baseY, w, h, cover, u) {
  const y = baseY - h;
  ctx.setFillColor(new Color("#000000", 0.45));
  ctx.fillRect(new Rect(x + 2 * u, y + 2.5 * u, w, h - 2 * u));

  if (cover.image) {
    ctx.drawImageInRect(cover.image, new Rect(x, y, w, h));
  } else {
    const color = pick(LEATHER, seeded(cover.book.id + "cover"));
    ctx.setFillColor(new Color(color));
    ctx.fillRect(new Rect(x, y, w, h));
    ctx.setStrokeColor(new Color(GOLD.base));
    ctx.setLineWidth(0.8 * u);
    ctx.strokeRect(new Rect(x + 3 * u, y + 3 * u, w - 6 * u, h - 6 * u));
    const fs = Math.max(6 * u, w * 0.13);
    ctx.setFont(new Font("Baskerville-Bold", fs));
    ctx.setTextColor(new Color(GOLD.hi));
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect(shortTitle(cover.book.title), new Rect(x + 5 * u, y + h * 0.22, w - 10 * u, h * 0.6));
  }
  // Hinge crease and edge.
  ctx.setFillColor(new Color("#000000", 0.28));
  ctx.fillRect(new Rect(x, y, w * 0.05, h));
  ctx.setFillColor(new Color("#ffffff", 0.18));
  ctx.fillRect(new Rect(x + w * 0.05, y, 0.6 * u, h));
  ctx.setStrokeColor(new Color("#000000", 0.55));
  ctx.setLineWidth(0.6 * u);
  ctx.strokeRect(new Rect(x, y, w, h));
}

function drawRibbon(ctx, x, y, len, u) {
  const w = 3.4 * u;
  const p = new Path();
  p.move(new Point(x, y - 3 * u));
  p.addLine(new Point(x + w, y - 3 * u));
  p.addLine(new Point(x + w, y + len));
  p.addLine(new Point(x + w / 2, y + len - 2 * u));
  p.addLine(new Point(x, y + len));
  p.closeSubpath();
  ctx.addPath(p);
  ctx.setFillColor(new Color(RIBBON));
  ctx.fillPath();
  ctx.setFillColor(new Color("#ffffff", 0.18));
  ctx.fillRect(new Rect(x, y - 3 * u, w * 0.35, len));
}

function drawPlaque(ctx, cx, plankTop, plank, text, u) {
  const fs = plank * 0.62;
  const w = text.length * fs * 0.5 + 8 * u, h = plank - 2.4 * u;
  const r = new Rect(cx - w / 2, plankTop + 1.4 * u, w, h);
  const p = new Path();
  p.addRoundedRect(r, 1.5 * u, 1.5 * u);
  ctx.addPath(p);
  ctx.setFillColor(new Color(GOLD.base));
  ctx.fillPath();
  ctx.setFillColor(new Color(GOLD.hi, 0.6));
  ctx.fillRect(new Rect(r.x + u, r.y + 0.5 * u, r.width - 2 * u, 0.6 * u));
  ctx.setFont(new Font("Baskerville-SemiBoldItalic", fs));
  ctx.setTextColor(new Color("#3a2208"));
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(text, new Rect(r.x, r.y + h / 2 - fs * 0.62, r.width, fs * 1.5));
}

// The enchanted rose under its bell jar.
function drawRose(ctx, cx, baseY, u) {
  const jw = 22 * u, jh = 40 * u, padH = 4.5 * u;
  const yb = baseY - padH, yt = yb - jh, r = jw / 2;
  const x0 = cx - r, x1 = cx + r, k = 0.5523;

  glow(ctx, cx, yt + jh * 0.45, 26 * u, 30 * u, "#ff5a7a", 0.03, 16);

  // Pedestal.
  ctx.setFillColor(new Color("#000000", 0.4));
  ctx.fillRect(new Rect(x0 - 1 * u, baseY - padH + 2 * u, jw + 8 * u, padH));
  const ped = new Path();
  ped.addRoundedRect(new Rect(x0 - 3 * u, baseY - padH, jw + 6 * u, padH), 1.5 * u, 1.5 * u);
  ctx.addPath(ped);
  ctx.setFillColor(new Color(WOOD.frame));
  ctx.fillPath();
  goldLine(ctx, [new Point(x0 - 3 * u, baseY - padH + 0.6 * u), new Point(x1 + 3 * u, baseY - padH + 0.6 * u)], 0.8 * u);

  // Stem and leaves.
  const bloomY = yt + jh * 0.38;
  const stem = new Path();
  stem.move(new Point(cx, bloomY + 4 * u));
  stem.addCurve(new Point(cx, yb), new Point(cx - 3 * u, bloomY + 14 * u), new Point(cx + 3 * u, yb - 10 * u));
  ctx.addPath(stem);
  ctx.setStrokeColor(new Color("#3d6b31"));
  ctx.setLineWidth(1.1 * u);
  ctx.strokePath();
  leaf(ctx, cx - 0.5 * u, bloomY + 13 * u, -1, u);
  leaf(ctx, cx + 0.8 * u, bloomY + 20 * u, 1, u);

  // Bloom.
  const petals = [[-3.2, 0.5, 4.2, 3.6], [3.2, 0.5, 4.2, 3.6], [0, 2.4, 5, 3.4], [-2, -1.6, 3.6, 3.4], [2, -1.6, 3.6, 3.4]];
  ctx.setFillColor(new Color("#8e0f24"));
  for (const [dx, dy, rx, ry] of petals) {
    ctx.fillEllipse(new Rect(cx + dx * u - rx * u, bloomY + dy * u - ry * u, 2 * rx * u, 2 * ry * u));
  }
  ctx.setFillColor(new Color("#c41e3a"));
  for (const [dx, dy, rx, ry] of [[-1.6, 0, 2.8, 2.8], [1.6, 0, 2.8, 2.8], [0, -1.2, 3, 2.6]]) {
    ctx.fillEllipse(new Rect(cx + dx * u - rx * u, bloomY + dy * u - ry * u, 2 * rx * u, 2 * ry * u));
  }
  ctx.setFillColor(new Color("#e2445e"));
  ctx.fillEllipse(new Rect(cx - 1.6 * u, bloomY - 2.2 * u, 3.2 * u, 2.4 * u));
  const swirl = new Path();
  swirl.move(new Point(cx - 1.8 * u, bloomY - 0.4 * u));
  swirl.addQuadCurve(new Point(cx + 1.8 * u, bloomY - 0.6 * u), new Point(cx, bloomY + 1.4 * u));
  ctx.addPath(swirl);
  ctx.setStrokeColor(new Color("#6e0a1b"));
  ctx.setLineWidth(0.6 * u);
  ctx.strokePath();

  // A fallen petal.
  ctx.setFillColor(new Color("#b3172f"));
  ctx.fillEllipse(new Rect(cx + 3.5 * u, yb - 2 * u, 3.6 * u, 1.8 * u));

  // Magic sparkles.
  const sr = seeded("sparkle");
  for (let i = 0; i < 7; i++) {
    const sx = x0 + 3 * u + sr() * (jw - 6 * u), sy = yt + 6 * u + sr() * (jh - 12 * u);
    const s = (0.5 + sr() * 0.8) * u;
    ctx.setFillColor(new Color(i % 2 ? "#ffd6e0" : GOLD.hi, 0.85));
    ctx.fillEllipse(new Rect(sx - s, sy - s, 2 * s, 2 * s));
  }

  // Glass dome.
  const dome = new Path();
  dome.move(new Point(x0, yb));
  dome.addLine(new Point(x0, yt + r));
  dome.addCurve(new Point(cx, yt), new Point(x0, yt + r - k * r), new Point(cx - k * r, yt));
  dome.addCurve(new Point(x1, yt + r), new Point(cx + k * r, yt), new Point(x1, yt + r - k * r));
  dome.addLine(new Point(x1, yb));
  dome.closeSubpath();
  ctx.addPath(dome);
  ctx.setFillColor(new Color("#ffffff", 0.07));
  ctx.fillPath();
  ctx.addPath(dome);
  ctx.setStrokeColor(new Color("#f6e7d3", 0.5));
  ctx.setLineWidth(0.8 * u);
  ctx.strokePath();
  const shine = new Path();
  shine.move(new Point(x0 + 2.6 * u, yb - 5 * u));
  shine.addLine(new Point(x0 + 2.6 * u, yt + r));
  shine.addQuadCurve(new Point(cx - 1 * u, yt + 2.6 * u), new Point(x0 + 3.4 * u, yt + 3.4 * u));
  ctx.addPath(shine);
  ctx.setStrokeColor(new Color("#ffffff", 0.35));
  ctx.setLineWidth(1.3 * u);
  ctx.strokePath();
  // Finial.
  ctx.setFillColor(new Color(GOLD.base));
  ctx.fillEllipse(new Rect(cx - 1.6 * u, yt - 2.6 * u, 3.2 * u, 3.2 * u));
}

function leaf(ctx, x, y, dir, u) {
  const p = new Path();
  p.move(new Point(x, y));
  p.addQuadCurve(new Point(x + dir * 6 * u, y - 2.5 * u), new Point(x + dir * 2.5 * u, y - 4 * u));
  p.addQuadCurve(new Point(x, y), new Point(x + dir * 4 * u, y + 1 * u));
  p.closeSubpath();
  ctx.addPath(p);
  ctx.setFillColor(new Color("#2f5d2a"));
  ctx.fillPath();
}

function drawNote(ctx, W, H, u, text) {
  const w = Math.min(W - 30 * u, 160 * u), h = 30 * u;
  const r = new Rect((W - w) / 2, H / 2 - h / 2, w, h);
  const p = new Path();
  p.addRoundedRect(r, 3 * u, 3 * u);
  ctx.addPath(p);
  ctx.setFillColor(new Color("#efe0bf", 0.95));
  ctx.fillPath();
  ctx.setFont(new Font("Baskerville-SemiBoldItalic", 8.5 * u));
  ctx.setTextColor(new Color("#3a2208"));
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(text, new Rect(r.x + 4 * u, r.y + 4.5 * u, r.width - 8 * u, h - 6 * u));
}

// ---------------------------------------------------------------------------
// Drawing helpers

function goldLine(ctx, pts, width) {
  for (const [c, a, dy] of [[GOLD.lo, 0.9, width * 0.5], [GOLD.base, 1, 0], [GOLD.hi, 0.5, -width * 0.35]]) {
    const p = new Path();
    p.move(new Point(pts[0].x, pts[0].y + dy));
    for (const pt of pts.slice(1)) p.addLine(new Point(pt.x, pt.y + dy));
    ctx.addPath(p);
    ctx.setStrokeColor(new Color(c, a));
    ctx.setLineWidth(width * (c === GOLD.base ? 1 : 0.6));
    ctx.strokePath();
  }
}

function rosette(ctx, x, y, r) {
  ctx.setFillColor(new Color(GOLD.lo));
  ctx.fillEllipse(new Rect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4));
  ctx.setFillColor(new Color(GOLD.base));
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    ctx.fillEllipse(new Rect(x + dx * r * 0.55 - r * 0.55, y + dy * r * 0.55 - r * 0.55, r * 1.1, r * 1.1));
  }
  ctx.setFillColor(new Color(GOLD.hi));
  ctx.fillEllipse(new Rect(x - r * 0.4, y - r * 0.4, r * 0.8, r * 0.8));
}

function vGradient(ctx, rect, top, bottom, steps = 32) {
  const h = rect.height / steps;
  for (let i = 0; i < steps; i++) {
    ctx.setFillColor(new Color(mix(top, bottom, i / (steps - 1))));
    ctx.fillRect(new Rect(rect.x, rect.y + i * h, rect.width, h + 0.5));
  }
}

function glow(ctx, cx, cy, rx, ry, hex, alpha, layers) {
  ctx.setFillColor(new Color(hex, alpha));
  for (let i = layers; i >= 1; i--) {
    const k = i / layers;
    ctx.fillEllipse(new Rect(cx - rx * k, cy - ry * k, 2 * rx * k, 2 * ry * k));
  }
}

function grain(ctx, rect, rng, u, vertical, count, alpha) {
  for (let i = 0; i < count; i++) {
    const p = new Path();
    const amp = (0.4 + rng() * 1.2) * u;
    const segs = 4;
    if (vertical) {
      const x = rect.x + amp + rng() * (rect.width - 2 * amp);
      p.move(new Point(x, rect.y));
      for (let s = 1; s <= segs; s++) {
        const y = rect.y + (rect.height * s) / segs;
        p.addQuadCurve(new Point(x, y), new Point(x + (s % 2 ? amp : -amp), y - rect.height / segs / 2));
      }
    } else {
      const y = rect.y + amp + rng() * Math.max(0, rect.height - 2 * amp);
      p.move(new Point(rect.x, y));
      for (let s = 1; s <= segs; s++) {
        const x = rect.x + (rect.width * s) / segs;
        p.addQuadCurve(new Point(x, y), new Point(x - rect.width / segs / 2, y + (s % 2 ? amp : -amp)));
      }
    }
    ctx.addPath(p);
    ctx.setStrokeColor(new Color(rng() < 0.5 ? "#000000" : "#c08050", alpha));
    ctx.setLineWidth((0.4 + rng() * 0.6) * u);
    ctx.strokePath();
  }
}

// ---------------------------------------------------------------------------
// Text helpers

function shortTitle(title) {
  return title.replace(/\s*\([^)]*#[^)]*\)\s*$/, "").split(/:\s/)[0].trim();
}

function spineTitle(title) {
  return shortTitle(title).toUpperCase().replace(/[^A-Z0-9À-Ý'&\s]/g, "").replace(/\s+/g, " ").trim();
}

// Choose up to `max` letters for a vertical spine, preferring whole words and
// dropping a leading article if that helps the title fit.
function fitLetters(title, max) {
  if (max <= 0 || !title) return [];
  let words = title.split(" ");
  if (title.length > max && words.length > 1 && /^(THE|A|AN)$/.test(words[0])) words = words.slice(1);
  const out = [];
  for (const word of words) {
    const need = (out.length ? 1 : 0) + word.length;
    if (out.length + need > max) {
      if (!out.length) return word.slice(0, max).split("");
      break;
    }
    if (out.length) out.push(" ");
    out.push(...word.split(""));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Small utilities

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

function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function mix(a, b, t) {
  const pa = hexRgb(a), pb = hexRgb(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
}

function hexRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

await main();
Script.complete();
