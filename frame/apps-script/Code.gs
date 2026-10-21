/**
 * Family Frame — Google Calendar + Google Drive photos feed.
 *
 * Paste this into a new project at https://script.google.com, fill in the
 * settings below, then Deploy > New deployment > Web app
 *   - Execute as: Me
 *   - Who has access: Anyone
 * Copy the Web app URL into frame/js/config.js (googleScriptUrl).
 *
 * The script runs as you, so your calendars and Drive folder stay private —
 * the frame only ever sees the events and photos this script hands out.
 */

// ============================ SETTINGS ============================

// Calendars to show. 'primary' is your main calendar. To add others (a shared
// family calendar, a partner's calendar shared with you, holidays, ...), open
// Google Calendar > Settings > [calendar] > "Integrate calendar" and copy the Calendar ID.
const CALENDAR_IDS = [
  'primary',
  // 'family123abc@group.calendar.google.com',
];

const DAYS_AHEAD = 14;

// The Google Drive folder with your frame photos. Open the folder in Drive and
// copy the last part of the URL: https://drive.google.com/drive/folders/THIS_PART
const PHOTO_FOLDER_ID = '';

// Optional password. If set, put the same value in config.js (accessKey).
const ACCESS_KEY = '';

// Largest photo (in MB) the script will send. Phone photos are usually 2–6 MB.
const MAX_PHOTO_MB = 15;

// ==================================================================

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (ACCESS_KEY && p.key !== ACCESS_KEY) throw new Error('Wrong or missing access key');
    if (p.photo) return json_(photo_(p.photo));
    const out = {};
    if (p.what !== 'photos') out.events = events_();
    if (p.what !== 'events') out.photos = photos_();
    return json_(out);
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function events_() {
  const tz = Session.getScriptTimeZone();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + (DAYS_AHEAD + 1) * 864e5);
  const out = [];

  CALENDAR_IDS.forEach(function (id) {
    const cal = id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(id);
    if (!cal) return;
    const color = cal.getColor();
    cal.getEvents(start, end).forEach(function (ev) {
      const allDay = ev.isAllDayEvent();
      out.push({
        title: ev.getTitle(),
        allDay: allDay,
        // All-day events are sent as plain dates so they never shift across time zones.
        start: allDay ? Utilities.formatDate(ev.getAllDayStartDate(), tz, 'yyyy-MM-dd') : ev.getStartTime().toISOString(),
        end: allDay ? Utilities.formatDate(ev.getAllDayEndDate(), tz, 'yyyy-MM-dd') : ev.getEndTime().toISOString(),
        location: ev.getLocation() || '',
        color: color,
        calendar: cal.getName(),
      });
    });
  });

  out.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  return out;
}

function photos_() {
  if (!PHOTO_FOLDER_ID) return [];
  const files = DriveApp.getFolderById(PHOTO_FOLDER_ID).getFiles();
  const out = [];
  while (files.hasNext()) {
    const f = files.next();
    if (isShowable_(f.getMimeType()) && !f.isTrashed()) {
      out.push({ id: f.getId(), name: f.getName(), updated: f.getLastUpdated().toISOString() });
    }
  }
  out.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return out;
}

function photo_(id) {
  const file = DriveApp.getFileById(id);
  // Only ever hand out files that live in the photo folder.
  let inFolder = false;
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === PHOTO_FOLDER_ID) inFolder = true;
  }
  if (!PHOTO_FOLDER_ID || !inFolder) throw new Error('Not a frame photo');
  if (!isShowable_(file.getMimeType())) throw new Error('Unsupported image type');
  if (file.getSize() > MAX_PHOTO_MB * 1024 * 1024) throw new Error('Photo too large');

  const blob = file.getBlob();
  return { data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}

function isShowable_(mime) {
  // HEIC (default iPhone format) can't be shown by most browsers — see README.
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(mime) >= 0;
}

/** Run this once from the editor to grant permissions and check your settings. */
function test() {
  Logger.log('Events: ' + JSON.stringify(events_().slice(0, 5), null, 2));
  Logger.log('Photos: ' + JSON.stringify(photos_().slice(0, 5), null, 2));
}
