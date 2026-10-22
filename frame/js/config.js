// =====================================================================
//  Family Frame settings — edit this file, then reload the frame.
// =====================================================================
window.FRAME_CONFIG = {
  // The "Web app URL" you get after deploying apps-script/Code.gs
  // (looks like https://script.google.com/macros/s/XXXX/exec).
  // This powers both the Google Calendar and the Google Drive photos.
  googleScriptUrl: '',

  // Optional shared secret. If you set ACCESS_KEY in Code.gs, put the same value here.
  accessKey: '',

  // Clock
  use24HourClock: false,

  weather: {
    // Change these to your home. Find coordinates by right-clicking a spot in Google Maps.
    latitude: 43.6532,
    longitude: -79.3832,
    locationName: 'Home',
    units: 'celsius',            // 'celsius' or 'fahrenheit'
    refreshMinutes: 15,
  },

  calendar: {
    // 'month' = full month grid like a wall calendar (tap a day to see its details)
    // 'agenda' = list of the next few days next to a bigger photo
    view: 'month',
    weekStartsOnMonday: false,
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
