// Renders the widget outside of iOS by emulating the parts of Scriptable's API
// it uses. Goodreads is replaced by tools/sample-feed.js, and covers by
// generated placeholders.
//
//   npm install @napi-rs/canvas
//   node tools/preview.js [outDir]

const fs = require("fs");
const path = require("path");
const { createCanvas } = require("@napi-rs/canvas");
const { sampleFeed } = require("./sample-feed");

const SCALE = 3;
const SCREEN = { width: 402, height: 874 }; // iPhone 17

function cssColor(c) {
  return `rgba(${c.r},${c.g},${c.b},${c.alpha})`;
}

class Color {
  constructor(hex, alpha = 1) {
    const h = hex.replace("#", "");
    this.r = parseInt(h.slice(0, 2), 16);
    this.g = parseInt(h.slice(2, 4), 16);
    this.b = parseInt(h.slice(4, 6), 16);
    this.alpha = alpha;
  }
}
class Point { constructor(x, y) { this.x = x; this.y = y; } }
class Size { constructor(width, height) { this.width = width; this.height = height; } }
class Rect {
  constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
}
class Font {
  constructor(name, size) {
    const italic = /Italic|Snell/.test(name) ? "italic " : "";
    const bold = /Bold/.test(name) ? "bold " : "";
    this.css = `${italic}${bold}${size}px "Liberation Serif"`;
    this.size = size;
  }
  static systemFont(s) { return new Font("System", s); }
  static boldSystemFont(s) { return new Font("System-Bold", s); }
  static semiboldSystemFont(s) { return new Font("System-Bold", s); }
}

class Path {
  constructor() { this.ops = []; }
  move(p) { this.ops.push(c => c.moveTo(p.x, p.y)); }
  addLine(p) { this.ops.push(c => c.lineTo(p.x, p.y)); }
  addCurve(p, c1, c2) { this.ops.push(c => c.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y)); }
  addQuadCurve(p, cp) { this.ops.push(c => c.quadraticCurveTo(cp.x, cp.y, p.x, p.y)); }
  addRect(r) { this.ops.push(c => c.rect(r.x, r.y, r.width, r.height)); }
  addRoundedRect(r, cw) { this.ops.push(c => c.roundRect(r.x, r.y, r.width, r.height, cw)); }
  closeSubpath() { this.ops.push(c => c.closePath()); }
}

class Image {
  constructor(canvas) { this.canvas = canvas; this.size = new Size(canvas.width / SCALE, canvas.height / SCALE); }
}

class DrawContext {
  set size(s) {
    this._size = s;
    this.canvas = createCanvas(Math.round(s.width * SCALE), Math.round(s.height * SCALE));
    this.c = this.canvas.getContext("2d");
    this.c.scale(SCALE, SCALE);
    this.c.beginPath();
    this.align = "left";
  }
  get size() { return this._size; }
  setFillColor(col) { this.c.fillStyle = cssColor(col); }
  setStrokeColor(col) { this.c.strokeStyle = cssColor(col); }
  setLineWidth(w) { this.c.lineWidth = w; }
  fillRect(r) { this.c.fillRect(r.x, r.y, r.width, r.height); }
  strokeRect(r) { this.c.strokeRect(r.x, r.y, r.width, r.height); }
  fillEllipse(r) {
    this.c.beginPath();
    this.c.ellipse(r.x + r.width / 2, r.y + r.height / 2, Math.abs(r.width / 2), Math.abs(r.height / 2), 0, 0, Math.PI * 2);
    this.c.fill();
    this.c.beginPath();
  }
  addPath(p) { for (const op of p.ops) op(this.c); }
  fillPath() { this.c.fill(); this.c.beginPath(); }
  strokePath() { this.c.stroke(); this.c.beginPath(); }
  drawImageInRect(img, r) { this.c.drawImage(img.canvas, r.x, r.y, r.width, r.height); }
  setFont(f) { this.font = f; }
  setTextColor(col) { this.textColor = col; }
  setTextAlignedCenter() { this.align = "center"; }
  setTextAlignedLeft() { this.align = "left"; }
  drawTextInRect(text, r) {
    const c = this.c;
    c.font = this.font.css;
    c.fillStyle = cssColor(this.textColor);
    c.textAlign = this.align;
    c.textBaseline = "top";
    const lh = this.font.size * 1.2;
    const lines = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const tryLine = line ? line + " " + word : word;
        if (line && c.measureText(tryLine).width > r.width) { lines.push(line); line = word; }
        else line = tryLine;
      }
      lines.push(line);
    }
    lines.forEach((line, i) => {
      if ((i + 1) * lh > r.height + 0.01 && i > 0) return; // iOS drops lines that don't fit
      const x = this.align === "center" ? r.x + r.width / 2 : r.x;
      c.fillText(line, x, r.y + i * lh + this.font.size * 0.08);
    });
  }
  getImage() { return new Image(this.canvas); }
}

class ListWidget {
  setPadding() {}
  addText(t) { return { text: t }; }
}

function placeholderCover(title, hue) {
  const w = 300, h = 450;
  const canvas = createCanvas(w, h);
  const c = canvas.getContext("2d");
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue},55%,45%)`);
  g.addColorStop(1, `hsl(${(hue + 40) % 360},60%,22%)`);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.font = 'bold 34px "Liberation Sans"';
  c.textAlign = "center";
  title.split(" ").forEach((word, i) => c.fillText(word.toUpperCase(), w / 2, 110 + i * 42));
  c.font = '22px "Liberation Sans"';
  c.fillText("A NOVEL", w / 2, 400);
  const img = new Image(canvas);
  img.size = new Size(w, h);
  return img;
}

async function render(family, outDir, feed) {
  const memory = {};
  const FileManager = {
    local: () => ({
      documentsDirectory: () => "/docs",
      joinPath: (a, b) => `${a}/${b}`,
      fileExists: p => p in memory || p === "/docs/enchanted-library",
      createDirectory: () => {},
      readString: p => memory[p],
      writeString: (p, s) => { memory[p] = s; },
      readImage: p => memory[p],
      writeImage: (p, i) => { memory[p] = i; },
      listContents: () => [],
      remove: () => {},
    }),
  };
  let hue = 10;
  class Request {
    constructor(url) { this.url = url; }
    async loadString() {
      const shelf = new URL(this.url).searchParams.get("shelf");
      this.response = { statusCode: feed === null ? 404 : 200 };
      if (feed === null) return "<html>Not found</html>";
      return feed(shelf);
    }
    async loadImage() {
      const m = this.url.match(/title=([^&]+)/);
      hue = (hue + 97) % 360;
      return placeholderCover(decodeURIComponent(m ? m[1] : "Book"), hue);
    }
  }
  let widget;
  const env = {
    Color, Point, Size, Rect, Font, Path, DrawContext, ListWidget, Request, FileManager,
    Device: { screenSize: () => new Size(SCREEN.width, SCREEN.height) },
    config: { runsInWidget: true, widgetFamily: family },
    Script: { setWidget: w => { widget = w; }, complete: () => {} },
    Alert: class {},
  };
  const src = fs.readFileSync(path.join(__dirname, "..", "EnchantedLibrary.js"), "utf8");
  const fn = new Function(...Object.keys(env), `return (async () => {\n${src}\n})();`);
  await fn(...Object.values(env));
  const out = path.join(outDir, `preview-${family}${feed === null ? "-error" : ""}.png`);
  fs.writeFileSync(out, widget.backgroundImage.canvas.toBuffer("image/png"));
  console.log("wrote", out);
}

(async () => {
  const outDir = process.argv[2] || path.join(__dirname, "..", "previews");
  fs.mkdirSync(outDir, { recursive: true });
  for (const family of ["small", "medium", "large"]) await render(family, outDir, sampleFeed);
  await render("medium", outDir, null);
})();
