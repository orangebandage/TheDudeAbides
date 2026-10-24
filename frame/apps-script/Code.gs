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

// Events with this word in their title or notes get a countdown on the frame.
const COUNTDOWN_TAG = '#countdown';
const COUNTDOWN_DAYS_AHEAD = 400;

// Google Sheet with your weekly meal plan: column A = day (Sunday…Saturday), column B = meal.
// Paste the sheet's link or ID between the quotes. Leave empty if you don't use it.
const MEALS_SHEET = '';

// ==================================================================

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (ACCESS_KEY && p.key !== ACCESS_KEY) throw new Error('Wrong or missing access key');
    if (p.photo) return json_(photo_(p.photo));
    const out = {};
    if (p.what !== 'photos') {
      out.events = events_(p.start, p.end);
      out.countdowns = countdowns_();
      out.meals = meals_();
    }
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
    const cal = calendar_(id);
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
        description: plainText_(ev.getDescription()),
        color: eventColor_(ev) || color,
        calendar: cal.getName(),
      });
    });
  });

  out.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  return out;
}

// The next date of every event tagged with COUNTDOWN_TAG (repeating events counted once).
function countdowns_() {
  const tz = Session.getScriptTimeZone();
  const tag = COUNTDOWN_TAG.toLowerCase();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + COUNTDOWN_DAYS_AHEAD * 864e5);
  const byTitle = {};
  CALENDAR_IDS.forEach(function (id) {
    const cal = calendar_(id);
    if (!cal) return;
    cal.getEvents(start, end, { search: COUNTDOWN_TAG.replace('#', '') }).forEach(function (ev) {
      const title = ev.getTitle() || '';
      if ((title + ' ' + ev.getDescription()).toLowerCase().indexOf(tag) < 0) return;
      const clean = title.replace(new RegExp('\\s*' + COUNTDOWN_TAG + '\\b', 'ig'), '').trim() || 'Countdown';
      const day = Utilities.formatDate(ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime(), tz, 'yyyy-MM-dd');
      if (!byTitle[clean] || day < byTitle[clean].date) {
        byTitle[clean] = { title: clean, date: day, color: eventColor_(ev) || cal.getColor() };
      }
    });
  });
  return Object.keys(byTitle).map(function (k) { return byTitle[k]; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

// An event's own colour (if you picked one in Google Calendar), as a hex colour.
const EVENT_COLORS_ = {
  1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#f6bf26', 6: '#f4511e',
  7: '#039be5', 8: '#616161', 9: '#3f51b5', 10: '#0b8043', 11: '#d50000',
};
function eventColor_(ev) {
  return EVENT_COLORS_[ev.getColor()] || '';
}

// Event descriptions can contain HTML; the frame shows plain text.
function plainText_(html) {
  const text = String(html || '')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 1500 ? text.slice(0, 1500) + '…' : text;
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

// Accepts a Calendar ID, 'primary', or a Google Calendar .ics link (the ID is pulled out of it).
function calendarId_(id) {
  let s = String(id || '').trim();
  const m = /calendar\.google\.com\/calendar\/ical\/([^\/]+)\//.exec(s);
  if (m) s = m[1];
  try { s = decodeURIComponent(s); } catch (e) {}
  return s;
}

function calendar_(id) {
  const cid = calendarId_(id);
  if (!cid || /^(https?|webcal):/i.test(cid)) return null;
  return cid === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(cid);
}

// Accepts the bare folder ID or a whole pasted Drive folder link.
// Rows of the meal plan sheet as [{ day, meal }]; rows that aren't a weekday (e.g. headings) are skipped.
function meals_() {
  const s = String(MEALS_SHEET || '').trim();
  if (!s) return [];
  const m = /\/d\/([\w-]+)/.exec(s);
  const sheet = SpreadsheetApp.openById(m ? m[1] : s).getSheets()[0];
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return sheet.getDataRange().getDisplayValues()
    .filter(function (r) { return days.indexOf(String(r[0]).trim().toLowerCase().slice(0, 3)) >= 0; })
    .map(function (r) { return { day: String(r[0]).trim(), meal: String(r[1] || '').trim() }; });
}

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
  Logger.log('Script account: ' + CalendarApp.getDefaultCalendar().getId());   // your main calendar's ID is your email
  CALENDAR_IDS.forEach(function (id) {
    const cid = calendarId_(id);
    let cal = null, why = '';
    try { cal = calendar_(id); } catch (err) { why = err.message; }
    if (cal) {
      const n = cal.getEvents(new Date(), new Date(Date.now() + DAYS_AHEAD * 864e5)).length;
      Logger.log('✓ Calendar "' + cal.getName() + '"  (' + cid + '): ' + n + ' events in the next ' + DAYS_AHEAD + ' days');
    } else if (/^(https?|webcal):/i.test(cid)) {
      Logger.log('✗ "' + id + '" is not a Google Calendar link. Add it in Google Calendar first ('
        + '+ next to "Other calendars" > From URL), then use its Calendar ID from Settings > Integrate calendar.');
    } else {
      Logger.log('✗ Calendar "' + cid + '" not found. Check the ID, and that it shows in this account\'s Google Calendar. ' + why);
    }
  });
  const events = events_();
  Logger.log('Events found: ' + events.length);
  countdowns_().forEach(function (c) { Logger.log('  Countdown: ' + c.date + '  ' + c.title); });
  meals_().forEach(function (r) { Logger.log('  Meal: ' + r.day + ' — ' + (r.meal || '(nothing)')); });
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
