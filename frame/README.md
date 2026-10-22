# Family Frame

A touch-screen dashboard for a picture frame:

- **Clock and weather.** Shows the current conditions and a 4-day forecast from Open-Meteo, which is free and needs no account.
- **Google Calendar, with Day and Month views.** It stays in sync with your Google account and can show several calendars. Tap **Day | Month** to switch views, ‹ › to move, and **Today** to jump back. Swipe left or right to move too. After 5 minutes untouched, it goes back to the starting view on today.
  - **Month:** a full wall-calendar grid. Today is outlined, each event has its calendar's colour, and busy days show "+2 more". Tap any date to open it in Day view.
  - **Day:** the day hour by hour, like Google Calendar. All-day events sit at the top, overlapping events go side by side, and a red line marks the current time.
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
6. Keep the URL and access key handy. You'll type them into the frame the first time it starts (see step 3). They're saved only on that device, never in GitHub.

> If you later edit `Code.gs`, use **Deploy → Manage deployments → ✏️ Edit → Version: New version** so the
> URL stays the same.

**Changing photos:** add or delete pictures in the Drive folder. The frame picks up changes within
30 minutes (`photos.refreshListMinutes`), or straight away if you tap the frame to reload it.

> 📱 **iPhone photos:** HEIC files can't be shown by most browsers. In the iPhone **Settings → Camera → Formats**,
> choose *Most Compatible*, or upload the photos to Drive as JPEG. The Google Drive app does this when you
> share a photo with it. JPG, PNG, WebP and GIF all work.

## 2. Edit `js/config.js`

- `calendar.view`: which view the frame starts on. Use `'month'` (the default) or `'day'`; you can switch between them on the frame. `'agenda'` instead shows a simple list of the next two weeks beside a bigger photo.
- `calendar.dayViewStartHour` / `dayViewEndHour`: the hours shown in Day view (7am to 10pm by default). It stretches automatically for earlier or later events.
- `calendar.weekStartsOnMonday`: `true` if you want weeks to start on Monday.
- `weather.latitude` / `longitude`: your home. In Google Maps, right-click your house and click the numbers to copy them.
- `worldClocks`: extra clocks next to the main one. It's set to Ontario and London; add, remove or rename them, using [time zone names](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) such as `America/Toronto` or `Europe/London`.
- `weather.units`: `'celsius'` or `'fahrenheit'`.
- `hockey.favoriteTeams`: e.g. `['TOR']`, `['BOS', 'NYR']`. Uses the standard NHL abbreviations.
- `hockey.showYesterdayUntilHour`: in the morning it shows last night's results; after this hour it switches to today.
- `photos.size`: `'small'`, `'medium'` or `'large'`, the room the photo gets next to the hockey scores.
- `photos.intervalSeconds`, `photos.shuffle`, `nightDim`, `use24HourClock`: adjust to taste.

## 3. Put it on the frame or iPad

### a) Publish the app with GitHub Pages (free, one time)

1. On GitHub, open the repository and go to **Settings → Pages**.
2. Under **Build and deployment**, set *Source* to **Deploy from a branch**. Then choose the branch that has the `frame` folder and the **/(root)** folder, and click **Save**.
3. After a minute or two the app is live at **`https://<your-username>.github.io/<repo-name>/frame/`**.

Any change pushed to that branch goes live within a couple of minutes. A frame that's already running picks it up at its next automatic reload (every 6 hours) or when you restart it.

> The app's code is public, but your calendar and photos are not. The script address and access key are typed in on
> each device and stored only there.

### b) iPad

1. Open the address above in **Safari**.
2. Tap the **Share** button (□↑) → **Add to Home Screen** → **Add**. You now have a **Family Frame** app icon.
3. Open the app from the home screen. It runs full screen with no Safari bars.
4. The first time, it asks for the **Web app URL** and **access key**. Paste them and tap **Test & save**.
5. To keep the screen on, go to **Settings → Display & Brightness → Auto-Lock → Never**, and keep the iPad plugged in.
6. Optional: use **Guided Access** to lock the iPad to the app. Turn it on in Settings → Accessibility → Guided Access, then triple-click the top or Home button inside the app.

### c) Android-based digital frame

1. Install **Fully Kiosk Browser** from the Play Store. Or use the frame's built-in browser.
2. Set the *Start URL* to the address above, and turn on *Keep screen on*, *Fullscreen* and *Start on boot*.
3. Enter the URL and access key when the setup screen appears.

Many photo-only frames (most Aura, Nixplay and Skylight models) can't run apps or web pages. This app needs a frame that has a web browser.

**To change the connection later**, press and hold the big clock for 2 seconds to open the setup screen again.

## Try it on a computer first

Open `frame/index.html` in Chrome or Edge. Weather and hockey work straight away. For the calendar and photos, enter your script URL and access key on the setup screen.
To test photos without Google, put files in `frame/photos/` and list them in `photos.local` in `config.js`.

## Where the data comes from

| Panel | Source | Key needed? |
|---|---|---|
| Weather | [Open-Meteo](https://open-meteo.com) | No |
| Hockey | NHL public feed (`api-web.nhle.com`), with ESPN's public scoreboard as a backup | No |
| Calendar + photos | Your own Google Apps Script (`apps-script/Code.gs`) | No, it runs as you |

The NHL and ESPN feeds are unofficial. If one changes, the frame switches to the other automatically.
