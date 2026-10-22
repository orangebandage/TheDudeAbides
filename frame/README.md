# Family Frame

A touch-screen dashboard for a picture frame:

- **Clock and weather.** Shows the current conditions and a 4-day forecast from Open-Meteo, which is free and needs no account.
- **Google Calendar.** A full month view, like a wall calendar, that stays in sync with your Google account. Today is outlined, each event has its calendar's colour, and busy days show "+2 more". Tap any day to see everything on it, and swipe or use ‹ › to change months. It goes back to the current month after 5 minutes. It can show several calendars.
- **NHL scores.** Swipe or tap the arrows to move between games, and tap the chips along the bottom to jump to one. Each game lists every goal with the scorer, their season total, the assists, the time and the score after the goal. Use the ‹ › arrows by the date to see other days. Live games update every minute. Your favourite teams come first.
- **Your photos.** A slideshow from a Google Drive folder, so you change the pictures by adding or removing them in Drive from your phone or computer. Swipe to change photos, double-tap to make the photo fill the whole screen, and tap ❚❚ to pause.

It's plain HTML/CSS/JavaScript with no build step and nothing to install. The screen dims at night, stays awake, and reloads itself every few hours.

```
frame/
├── index.html
├── css/style.css
├── js/config.js        ← the only file you need to edit
├── js/*.js
├── photos/             ← optional: photos stored next to the app
└── apps-script/Code.gs ← paste into Google Apps Script (calendar + Drive photos)
```

---

## 1. Set up the Google part (calendar + photos), about 10 minutes

The frame can't sign into Google on its own, so a small script in *your* Google
account reads your calendar and photo folder and hands them to the frame.
Your calendar and photos are not made public.

1. **Make the photo folder.** In Google Drive, create a folder such as `Frame Photos` and add some pictures.
   Open the folder and copy the ID from the address bar:
   `https://drive.google.com/drive/folders/`**`1AbCdEf...`**
2. Go to <https://script.google.com> and click **New project**.
3. Delete what's in the editor, paste in all of `apps-script/Code.gs`, and fill in the settings at the top:
   - `PHOTO_FOLDER_ID`: the folder ID from step 1.
   - `CALENDAR_IDS`: leave `'primary'` for your main calendar. Add other calendars with their
     Calendar ID, found in Google Calendar under ⚙ Settings → *the calendar* → **Integrate calendar** → Calendar ID.
     This works for a shared family calendar or one your partner shares with you.
   - `ACCESS_KEY` (optional but recommended): any password-like word.
4. Click 💾 **Save**. Then choose `test` in the function dropdown and click **Run**. Google asks for permission:
   click **Review permissions**, pick your account, then **Advanced → Go to (project) → Allow**.
   The log should list some events and photos.
5. Click **Deploy → New deployment**, click the ⚙ gear, and choose **Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Click **Deploy** and copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).
6. Open `js/config.js` and paste the URL into `googleScriptUrl`. If you set an `ACCESS_KEY`, put the same word in `accessKey`.

> If you later edit `Code.gs`, use **Deploy → Manage deployments → ✏️ Edit → Version: New version** so the
> URL stays the same.

**Changing photos:** add or delete pictures in the Drive folder. The frame picks up changes within
30 minutes (`photos.refreshListMinutes`), or straight away if you tap the frame to reload it.

> 📱 **iPhone photos:** HEIC files can't be shown by most browsers. In the iPhone **Settings → Camera → Formats**,
> choose *Most Compatible*, or upload the photos to Drive as JPEG. The Google Drive app does this when you
> share a photo with it. JPG, PNG, WebP and GIF all work.

## 2. Edit `js/config.js`

- `calendar.view`: `'month'` (the full month grid, the default) or `'agenda'` (a list of the next two weeks beside a bigger photo).
- `calendar.weekStartsOnMonday`: `true` if you want weeks to start on Monday.
- `weather.latitude` / `longitude`: your home. In Google Maps, right-click your house and click the numbers to copy them.
- `weather.units`: `'celsius'` or `'fahrenheit'`.
- `hockey.favoriteTeams`: e.g. `['TOR']`, `['BOS', 'NYR']`. Uses the standard NHL abbreviations.
- `hockey.showYesterdayUntilHour`: in the morning it shows last night's results; after this hour it switches to today.
- `photos.intervalSeconds`, `photos.shuffle`, `nightDim`, `use24HourClock`: adjust to taste.

## 3. Put it on the frame

The frame needs a web browser, which most Android-based touch-screen frames have. Choose one of these:

**A. Host it online (easiest to update).** Upload the `frame/` folder to any static host and open the address on the frame:
- **Netlify Drop**: drag the `frame` folder onto <https://app.netlify.com/drop>.
- **GitHub Pages**: works if the repo is public, or on a paid GitHub plan. In the repo, go to Settings → Pages.

  ⚠️ If you host it publicly, set an `ACCESS_KEY`. Otherwise anyone who finds your script URL could read your calendar.

**B. Copy it onto the frame.** Copy the `frame` folder to the frame's storage and open `index.html` in its browser.

**Best browser setup (Android frames):** install **Fully Kiosk Browser** from the Play Store. Set the start URL to your
address and turn on *Keep screen on*, *Fullscreen* and *Autostart on boot*. This makes the frame boot straight into the
dashboard. In a normal browser, tap once and the page goes fullscreen.

## Try it on a computer first

Open `frame/index.html` in Chrome or Edge. Weather and hockey work straight away. The calendar and photos need step 1.
To test photos without Google, put files in `frame/photos/` and list them in `photos.local` in `config.js`.

## Where the data comes from

| Panel | Source | Key needed? |
|---|---|---|
| Weather | [Open-Meteo](https://open-meteo.com) | No |
| Hockey | NHL public feed (`api-web.nhle.com`), with ESPN's public scoreboard as a backup | No |
| Calendar + photos | Your own Google Apps Script (`apps-script/Code.gs`) | No, it runs as you |

The NHL and ESPN feeds are unofficial. If one changes, the frame switches to the other automatically.
