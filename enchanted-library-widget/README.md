# Enchanted Library — Goodreads bookshelf widget

An iPhone home-screen widget, built for the [Scriptable](https://scriptable.app) app. It draws a dark-wood library bookcase inspired by the Beast's library: an arched gold-trimmed crown, gilt-lettered leather spines, candlelight, and the enchanted rose under glass. Your Goodreads books fill the shelves:

- **Currently reading:** cover facing out, with a red ribbon bookmark
- **Favorites:** leather spines with the title in gold
- Any leftover space is filled with untitled antique volumes, so the case always looks full

| Small | Medium | Large |
|---|---|---|
| ![small](previews/preview-small.png) | ![medium](previews/preview-medium.png) | ![large](previews/preview-large.png) |

*(The previews use sample books and placeholder covers. On your phone you'll see your real shelves and real cover art.)*

## Install on your iPhone

1. **Make your Goodreads shelves public.** Goodreads retired its API, so the widget reads your shelves' public RSS feeds. In the Goodreads app or website, go to *Settings → Privacy* and set **Who can view my profile** to *anyone* (or *anyone including search engines*).
2. **Check your favorites shelf name.** The widget reads the shelf named `favorites`. If yours is named something else (e.g. `all-time-favorites`), change `spineShelf` near the top of the script.
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
| `goodreadsUserId` | The number in your profile URL (`183463841`) |
| `readingShelf` | Shelf shown face-out with ribbons (`currently-reading`) |
| `spineShelf` | Shelf shown as spines (`favorites`) |
| `libraryName` | Script lettering on the large widget's crown (`"My Library"`) |
| `fillEmptySpace` | `false` leaves empty shelf space instead of antique filler books |
| `showRose` | `false` hides the enchanted rose |
| `refreshHours` | How often to ask iOS for a refresh |

To force a re-download (for example, after you change a cover on Goodreads), run the script in Scriptable and pick **Clear cache & refresh**.

## Troubleshooting

- **"Couldn't reach Goodreads. Is your profile public?"** Make your profile public (step 1). Also check that `https://www.goodreads.com/review/list_rss/183463841?shelf=favorites` opens in Safari.
- **No spines:** the `favorites` shelf is empty or has a different name (step 2).
- **Lock screen:** the script also works as a lock-screen widget. It shows the title of the book you're reading as text.

## Development

`tools/preview.js` renders the widget on a computer by emulating Scriptable's drawing API, with sample data from `tools/sample-feed.js`:

```sh
npm install @napi-rs/canvas
node tools/preview.js        # writes previews/*.png
```
