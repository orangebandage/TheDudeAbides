# Enchanted Library — Goodreads bookshelf widget

An iPhone home-screen widget for the [Scriptable](https://scriptable.app) app that shows your Goodreads books on a bookshelf. It comes in three looks:

- **Cozy**: floating wooden shelves on a cream cable-knit background, with fairy lights, autumn leaves, a potted plant and trailing ivy. Your books mix face-out covers with spines made from each cover's colors.
- **Rustic** (the default): a weathered wood-plank wall with slim shelves, brass shelf labels, a glowing table lamp and a brass alarm clock. Books stand as spines with the title and author, and each shelf has a brass label.
- **Enchanted**: a candle-lit, dark-wood library inspired by the Beast's library in *Beauty and the Beast*, with an arched gilded bookcase, leather-bound spines, a brass candlestick and the rose under glass.

Either way:

- **Currently reading:** cover facing out, with a red ribbon bookmark
- **Read:** your most recently finished books, as spines with the title and author (the cozy look also turns some covers face-out)
- **To-read (TBR):** a second shelf of books on the large widget. Small and medium widgets show only Read.
- Leftover space fills with a stack of books and some untitled volumes

| Small | Medium | Large |
|---|---|---|
| ![small](previews/preview-small.png) | ![medium](previews/preview-medium.png) | ![large](previews/preview-large.png) |

Cozy look: ![cozy](previews/preview-cozy-medium.png)

Enchanted look: ![enchanted](previews/preview-enchanted-medium.png)

*(The previews use stand-in covers. On your phone you'll see your real cover art.)*

## Install on your iPhone

1. **Make your Goodreads shelves public.** Goodreads retired its API, so the widget reads your shelves' public RSS feeds. In the Goodreads app or website, go to *Settings → Privacy* and set **Who can view my profile** to *anyone* (or *anyone including search engines*).
2. **Check your shelves.** The widget reads your `currently-reading`, `read` and `to-read` shelves, which every Goodreads account has. To show a different shelf, such as your own `favorites` shelf, change `shelves` near the top of the script.
3. Install **Scriptable** (free) from the App Store.
4. Copy the entire contents of [`EnchantedLibrary.js`](EnchantedLibrary.js). Open Scriptable, tap **+**, paste, and rename the script to *Enchanted Library* by tapping the title.
5. Tap ▶︎ to try it. Pick a size to preview. The first run downloads your covers.
6. Go to your home screen. Long-press an empty spot, tap **Edit → Add Widget**, search for **Scriptable**, choose a size, and tap **Add Widget**.
7. Long-press the new widget, choose **Edit Widget**, and set **Script** to *Enchanted Library*. Leave *When Interacting* set to **Open URL** so a tap opens your Goodreads profile. Repeat for any other sizes you want.

The widget refreshes every few hours; iOS decides exactly when. It keeps the last shelves it loaded, so it still shows books while you're offline.

## Customizing

Edit the `CONFIG` block at the top of the script:

| Setting | What it does |
|---|---|
| `theme` | `"rustic"`, `"cozy"` or `"enchanted"` |
| `goodreadsUserId` | The number in your profile URL (`183463841`) |
| `readingShelf` | Shelf shown face-out with ribbons, at the front of the top shelf (`currently-reading`; `""` to skip) |
| `shelves` | Shelves to show, top to bottom, each with the label shown on its brass plaque in the rustic look (`read` labeled "Read", then `to-read` labeled "TBR"). Large widgets show one shelf of books per entry; small and medium show only the first. |
| `libraryName` | Enchanted only: script lettering on the large widget's crown (`"My Library"`) |
| `fillEmptySpace` | `false` leaves empty shelf space instead of antique filler books |
| `showRose`, `showCandle` | Enchanted only: `false` hides the rose or the candlestick |
| `showPlant`, `showLights`, `showLeaves` | Cozy only: `false` hides the plant and ivy, the fairy lights, or the autumn leaves |
| `showLamp`, `showClock`, `showLabels` | Rustic only: `false` hides the lamp, the clock, or the brass shelf labels |
| `refreshHours` | How often to ask iOS for a refresh |

To force a re-download (for example, after you change a cover on Goodreads), run the script in Scriptable and pick **Clear cache & refresh**.

## Troubleshooting

- **"Couldn't reach Goodreads. Is your profile public?"** Make your profile public (step 1). Also check that `https://www.goodreads.com/review/list_rss/183463841?shelf=read` opens in Safari.
- **No spines:** the shelves named in `shelves` are empty or named differently (step 2).
- **"Open Scriptable and run Enchanted Library once":** the widget couldn't paint the scene itself and had no saved picture yet. Run the script once in the Scriptable app. That saves pictures of every size for the widget to fall back on.
- **Plain-looking lettering:** the fonts (Cinzel, Cormorant Garamond, Oswald, Pinyon Script) load from Google Fonts. Without internet access the widget uses the iPhone's built-in fonts instead.
- **Lock screen:** the script also works as a lock-screen widget. It shows the title of the book you're reading as text.

## How it works

Scriptable's built-in drawing tools can't do gradients, soft shadows or sideways text. So the script paints the scene in an invisible web view, using a standard HTML canvas, and hands the finished picture to the widget. The painter is the `renderLibrary` function, between the `<renderer>` markers in the script.

## Development

`tools/preview.js` runs that same painter on a computer, with sample books from `tools/sample-feed.js`:

```sh
npm install @napi-rs/canvas
node tools/preview.js path/to/fonts   # writes previews/*.png
THEME=rustic node tools/preview.js path/to/fonts out/   # or THEME=enchanted
```

The fonts folder should hold the Cinzel, Cormorant Garamond, Oswald and Pinyon Script `.ttf` files from Google Fonts. Set `COVERS_DIR` to a folder of cover images named `<book id>.jpg` to preview with real covers.
