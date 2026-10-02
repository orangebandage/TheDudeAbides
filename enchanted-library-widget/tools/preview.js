// Renders the widget on a computer using the same painter the phone uses
// (renderLibrary, extracted from EnchantedLibrary.js), with sample books from
// tools/sample-feed.js and generated stand-in covers.
//
//   npm install @napi-rs/canvas
//   node tools/preview.js [fontDir] [outDir]
//
// Set COVERS_DIR to a folder of real cover images named <book id>.jpg to use
// them instead of the generated stand-ins.
//
// fontDir may hold Cinzel, Cormorant Garamond and Pinyon Script .ttf files
// (from Google Fonts) so the preview uses the same lettering as the phone.

const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts, loadImage } = require("@napi-rs/canvas");
const { sampleBooks } = require("./sample-feed");

const src = fs.readFileSync(path.join(__dirname, "..", "EnchantedLibrary.js"), "utf8");
const body = src.split("// <renderer>")[1].split("// </renderer>")[0];
const renderLibrary = new Function(`${body}; return renderLibrary;`)();

const SCREEN_W = 402; // iPhone 17
const SIZES = {
  small: [Math.round(SCREEN_W * 0.405), Math.round(SCREEN_W * 0.405)],
  medium: [Math.round(SCREEN_W * 0.86), Math.round(SCREEN_W * 0.405)],
  large: [Math.round(SCREEN_W * 0.86), Math.round(SCREEN_W * 0.86 * 1.05)],
};
const CONFIG = {
  theme: process.env.THEME || "enchanted", libraryName: "My Library", fillEmptySpace: true,
  showRose: true, showCandle: true, showPlant: true, showLights: true, showLeaves: true,
  showLamp: true, showClock: true, showLabels: true, ornateSpines: process.env.ORNATE || "tbr",
  readingShelf: "currently-reading",
};

function stubCover(book, i) {
  const w = 300, h = 450;
  const c = createCanvas(w, h);
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${book.hue},45%,38%)`);
  g.addColorStop(1, `hsl(${(book.hue + 30) % 360},55%,14%)`);
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.strokeStyle = "rgba(255,230,180,0.7)";
  x.lineWidth = 3;
  x.strokeRect(18, 18, w - 36, h - 36);
  x.fillStyle = "#fbefd5";
  x.textAlign = "center";
  x.font = 'italic 600 46px "Cormorant Garamond"';
  const words = book.title.split(" (")[0].split(" ");
  const lines = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && x.measureText(last + " " + word).width < w - 70) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  lines.forEach((ln, j) => x.fillText(ln, w / 2, 150 + j * 50));
  x.font = '700 18px "Cinzel"';
  x.fillText(book.author.toUpperCase(), w / 2, h - 50);
  return c;
}

const covers = {};
async function loadCovers() {
  const dir = process.env.COVERS_DIR;
  if (!dir) return;
  for (const f of fs.readdirSync(dir)) covers[path.parse(f).name] = await loadImage(path.join(dir, f));
}

function render(family, outDir, note) {
  const [width, height] = SIZES[family];
  const scale = 3;
  const canvas = createCanvas(width * scale, height * scale);
  const reading = note ? [] : sampleBooks.reading.map((b, i) => ({ ...b, img: covers[b.id] || stubCover(b, i) }));
  const max = { small: 1, medium: 2, large: 3 }[family];
  const withImg = books => (note ? [] : books.map((b, i) => ({ ...b, img: covers[b.id] || stubCover(b, i) })));
  const groups = [
    { label: "Read", books: reading.slice(max).concat(withImg(sampleBooks.read)) },
    { label: "TBR", books: withImg(sampleBooks.toRead) },
  ].slice(0, family === "large" ? 2 : 1);
  const scene = {
    family, width, height, scale, config: CONFIG, note: note || "",
    covers: reading.slice(0, max),
    groups,
  };
  renderLibrary(canvas, scene, (w, h) => createCanvas(w, h));
  const out = path.join(outDir, `preview-${family}${note ? "-error" : ""}.png`);
  fs.writeFileSync(out, canvas.toBuffer("image/png"));
  console.log("wrote", out);
}

const fontDir = process.argv[2];
if (fontDir) for (const f of fs.readdirSync(fontDir)) GlobalFonts.registerFromPath(path.join(fontDir, f));
const outDir = process.argv[3] || path.join(__dirname, "..", "previews");
fs.mkdirSync(outDir, { recursive: true });
loadCovers().then(() => {
  for (const family of ["small", "medium", "large"]) render(family, outDir);
  render("medium", outDir, "Couldn’t reach Goodreads.\nIs your profile public?");
});
