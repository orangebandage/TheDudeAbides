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

const DAYS_AHEAD = 14;      // default range when the frame doesn't ask for one
const MAX_RANGE_DAYS = 62;  // largest date range the frame may ask for (a month grid is ~42 days)

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
    if (p.what !== 'photos') out.events = events_(p.start, p.end);
    if (p.what !== 'events') out.photos = photos_();
    return json_(out);
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// start/end are optional 'yyyy-MM-dd' dates sent by the frame (the month on screen).
function events_(startParam, endParam) {
  const tz = Session.getScriptTimeZone();
  let start = parseDay_(startParam);
  let end = parseDay_(endParam);
  if (!start) {
    start = new Date();
    start.setHours(0, 0, 0, 0);
  }
  if (!end || end <= start) end = new Date(start.getTime() + (DAYS_AHEAD + 1) * 864e5);
  // Keep requests to a sensible size.
  if (end - start > MAX_RANGE_DAYS * 864e5) end = new Date(start.getTime() + MAX_RANGE_DAYS * 864e5);
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

function parseDay_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function photos_() {
  if (!folderId_()) return [];
  const files = DriveApp.getFolderById(folderId_()).getFiles();
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
    if (parents.next().getId() === folderId_()) inFolder = true;
  }
  if (!folderId_() || !inFolder) throw new Error('Not a frame photo');
  if (!isShowable_(file.getMimeType())) throw new Error('Unsupported image type');
  if (file.getSize() > MAX_PHOTO_MB * 1024 * 1024) throw new Error('Photo too large');

  const blob = file.getBlob();
  return { data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}

// Accepts the bare folder ID or a whole pasted Drive folder link.
function folderId_() {
  const s = String(PHOTO_FOLDER_ID || '').trim();
  const m = /folders\/([\w-]+)/.exec(s) || /[?&]id=([\w-]+)/.exec(s);
  return m ? m[1] : s.split('?')[0];
}

function isShowable_(mime) {
  // HEIC (default iPhone format) can't be shown by most browsers — see README.
  return ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(mime) >= 0;
}

/** Run this once from the editor to grant permissions and check your settings. */
function test() {
  const events = events_();
  Logger.log('Events found: ' + events.length);
  events.slice(0, 5).forEach(function (e) { Logger.log('  ' + e.start + '  ' + e.title); });

  if (!folderId_()) {
    Logger.log('Photos: PHOTO_FOLDER_ID is empty — paste your Drive folder ID (or link) at the top.');
    return;
  }
  let folder;
  try {
    folder = DriveApp.getFolderById(folderId_());
  } catch (err) {
    Logger.log('Photos: could not open a folder with ID "' + folderId_() + '". Check PHOTO_FOLDER_ID. (' + err.message + ')');
    return;
  }
  Logger.log('Photo folder: "' + folder.getName() + '"');
  const files = folder.getFiles();
  let total = 0, shown = 0;
  while (files.hasNext()) {
    const f = files.next();
    const ok = isShowable_(f.getMimeType());
    total++;
    if (ok) shown++;
    if (total <= 20) Logger.log('  ' + (ok ? '✓ ' : '✗ skipped ') + f.getName() + '  (' + f.getMimeType() + ')');
  }
  const subfolders = folder.getFolders().hasNext();
  Logger.log('Photos the frame will show: ' + shown + ' of ' + total + ' files'
    + (subfolders ? '. Note: photos inside sub-folders are not included — put them directly in this folder.' : ''));
}
