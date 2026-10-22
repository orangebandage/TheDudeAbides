// =====================================================================
//  Family Frame settings — edit this file, then reload the frame.
// =====================================================================
window.FRAME_CONFIG = {
  // The "Web app URL" you get after deploying apps-script/Code.gs
  // (looks like https://script.google.com/macros/s/XXXX/exec).
  // This powers both the Google Calendar and the Google Drive photos.
  // Best left EMPTY: the frame asks for it on first start and saves it on the device only,
  // so it never ends up in GitHub. (Press and hold the big clock to change it later.)
  googleScriptUrl: '',

  // Optional shared secret. If you set ACCESS_KEY in Code.gs, enter the same value on the frame.
  accessKey: '',

  // Clock
  use24HourClock: false,

  // Extra clocks shown next to the main clock (which uses the frame's own time).
  // timeZone names: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  worldClocks: [
    { label: 'Ontario', timeZone: 'America/Toronto' },
    { label: 'London', timeZone: 'Europe/London' },
  ],

  weather: {
    // Change these to your home. Find coordinates by right-clicking a spot in Google Maps.
    latitude: 49.2193,
    longitude: -122.5984,
    locationName: 'Maple Ridge',
    units: 'celsius',            // 'celsius' or 'fahrenheit'
    refreshMinutes: 15,
  },

  calendar: {
    // Which view the frame starts on (and returns to after 5 minutes untouched):
    //   'month'  = full month grid like a wall calendar
    //   'day'    = today hour by hour
    //   Tap Day / Month on the frame to switch; tap a date in the month to open that day.
    //   'agenda' = a simple list of the next few days next to a bigger photo (no Day/Month switch)
    view: 'month',
    weekStartsOnMonday: false,
    dayViewStartHour: 7,         // hours shown in the day view (it stretches for earlier/later events)
    dayViewEndHour: 22,
    daysAhead: 14,               // used by the 'agenda' view
    refreshMinutes: 5,
  },

  hockey: {
    // Team abbreviations shown first, e.g. ['TOR', 'MTL', 'BOS', 'NYR', 'EDM', 'DET', 'PIT'].
    favoriteTeams: ['TOR'],
    // Before this hour (24h), the frame shows yesterday's results instead of today's games.
    showYesterdayUntilHour: 10,
    refreshMinutesLive: 1,
    refreshMinutesIdle: 10,
    // Automatically flip to the next game every N seconds (0 = only when you tap/swipe).
    autoAdvanceSeconds: 0,
  },

  photos: {
    // How much room the photo gets next to the hockey scores: 'small', 'medium' or 'large'.
    // (Double-tap the photo on the frame to see it full screen.)
    size: 'medium',
    intervalSeconds: 30,
    shuffle: true,
    refreshListMinutes: 30,      // how often to check the Drive folder for new/removed photos
    // Photos stored right next to the app (used when googleScriptUrl is empty,
    // or added alongside the Drive photos). Paths are relative to index.html.
    local: [
      // 'photos/beach.jpg',
      // 'photos/kids-2026.jpg',
    ],
  },

  // Dim the screen at night. Set enabled: false to turn off.
  nightDim: { enabled: true, fromHour: 22, toHour: 6, opacity: 0.65 },

  // Reload the whole page every N hours (keeps a 24/7 browser healthy and picks up config changes).
  reloadEveryHours: 6,
};
