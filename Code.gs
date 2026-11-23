const SHEET_ID = "1dm1XZRWtPAUxVO5LuHakbrIM4lOJQfOisNocijmt-cU";
// Change this before deploying. Use a long, private password.
const ADMIN_PASSWORD = "CHANGE_THIS_TO_A_PRIVATE_PASSWORD";
const USERS_SHEET = "Users";
const HISTORY_SHEET = "Location_History";
const SESSION_SECONDS = 21600; // 6 hours

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.api) return handleApi_(p);
  if (p.page === "track") {
    const t = HtmlService.createTemplateFromFile("Tracker");
    t.userId = String(p.id || "");
    t.token = String(p.token || "");
    t.appUrl = ScriptApp.getService().getUrl();
    return t.evaluate().setTitle("Location Sharing").addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
  const t = HtmlService.createTemplateFromFile("Index");
  t.appUrl = ScriptApp.getService().getUrl();
  return t.evaluate().setTitle("LiveTrack Admin").addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let u = ss.getSheetByName(USERS_SHEET);
  if (!u) u = ss.insertSheet(USERS_SHEET);
  if (u.getLastRow() === 0) {
    u.appendRow(["User ID", "Name", "Token", "Created At", "Status", "Last Seen", "Latitude", "Longitude", "Accuracy", "Maps URL"]);
    u.setFrozenRows(1); u.getRange(1,1,1,10).setFontWeight("bold");
  }
  let h = ss.getSheetByName(HISTORY_SHEET);
  if (!h) h = ss.insertSheet(HISTORY_SHEET);
  if (h.getLastRow() === 0) {
    h.appendRow(["User ID", "Name", "Date & Time", "Latitude", "Longitude", "Accuracy", "Maps URL"]);
    h.setFrozenRows(1); h.getRange(1,1,1,7).setFontWeight("bold");
  }
  return "Sheets ready";
}

function handleApi_(p) {
  const callback = String(p.callback || "");
  if (!/^[a-zA-Z_$][0-9a-zA-Z_$\.\[\]]*$/.test(callback) || callback.length > 100) {
    return ContentService.createTextOutput("Invalid callback").setMimeType(ContentService.MimeType.TEXT);
  }
  let result;
  try {
    switch (String(p.api)) {
      case "login": result = apiLogin_(p.password); break;
      case "createUser": requireSession_(p.session); result = createUser_(p.name); break;
      case "getUsers": requireSession_(p.session); result = getUsers_(); break;
      case "saveLocation": result = saveLocation_(p); break;
      case "stopSharing": result = stopSharing_(p); break;
      default: throw new Error("Unknown API action.");
    }
    return jsonp_(callback, { ok: true, data: result });
  } catch (err) {
    return jsonp_(callback, { ok: false, error: err && err.message ? err.message : String(err) });
  }
}
function jsonp_(callback, obj) {
  return ContentService.createTextOutput(callback + "(" + JSON.stringify(obj) + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function apiLogin_(password) {
  if (ADMIN_PASSWORD === "CHANGE_THIS_TO_A_PRIVATE_PASSWORD") throw new Error("Set your private ADMIN_PASSWORD in Code.gs first.");
  if (String(password || "") !== ADMIN_PASSWORD) throw new Error("Incorrect admin password.");
  const session = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  CacheService.getScriptCache().put("admin_" + session, "1", SESSION_SECONDS);
  return { session: session, expiresIn: SESSION_SECONDS };
}
function requireSession_(session) {
  if (!session || CacheService.getScriptCache().get("admin_" + String(session)) !== "1") throw new Error("Admin session expired. Please log in again.");
}
function createUser_(name) {
  name = String(name || "").trim();
  if (!name) throw new Error("Please enter a user name.");
  if (name.length > 80) throw new Error("Name must be 80 characters or fewer.");
  setupSheets();
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET);
  const userId = "U" + Utilities.getUuid().replace(/-/g, "").slice(0,10).toUpperCase();
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const created = new Date();
  sh.appendRow([userId, name, token, created, "Not started", "", "", "", "", ""]);
  const base = ScriptApp.getService().getUrl();
  if (!base) throw new Error("Deploy as a Web App before creating links.");
  return { userId: userId, name: name, link: base + "?page=track&id=" + encodeURIComponent(userId) + "&token=" + encodeURIComponent(token), createdAt: created.toISOString() };
}
function getUsers_() {
  setupSheets();
  const values = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET).getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(r => r[0]).map(r => ({
    userId:String(r[0]), name:String(r[1]), createdAt:iso_(r[3]), status:String(r[4] || "Not started"),
    lastSeen:iso_(r[5]), latitude:r[6] === "" ? null : Number(r[6]), longitude:r[7] === "" ? null : Number(r[7]),
    accuracy:r[8] === "" ? null : Number(r[8]), mapsUrl:String(r[9] || "")
  })).reverse();
}
function iso_(v) { if (!v) return ""; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? "" : d.toISOString(); }
function findUser_(id, token) {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET);
  if (!sh || sh.getLastRow() < 2) throw new Error("Tracking link not found.");
  const rows = sh.getRange(2,1,sh.getLastRow()-1,10).getValues();
  for (let i=0;i<rows.length;i++) if (String(rows[i][0]) === String(id) && String(rows[i][2]) === String(token)) return { sheet:sh, row:i+2, name:String(rows[i][1]) };
  throw new Error("Invalid tracking link.");
}
function saveLocation_(p) {
  const lat = Number(p.latitude), lng = Number(p.longitude), acc = Number(p.accuracy);
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("Invalid GPS coordinates.");
  setupSheets();
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const user = findUser_(p.userId, p.token), ss = SpreadsheetApp.openById(SHEET_ID), history = ss.getSheetByName(HISTORY_SHEET);
    const now = new Date(), maps = "https://www.google.com/maps?q=" + lat + "," + lng;
    user.sheet.getRange(user.row,5,1,6).setValues([["Online", now, lat, lng, isFinite(acc) ? acc : "", maps]]);
    const clientDate = p.clientTime ? new Date(p.clientTime) : now;
    history.appendRow([String(p.userId), user.name, isNaN(clientDate.getTime()) ? now : clientDate, lat, lng, isFinite(acc) ? acc : "", maps]);
    return { saved:true, receivedAt:now.toISOString() };
  } finally { lock.releaseLock(); }
}
function stopSharing_(p) {
  const user = findUser_(p.userId, p.token);
  user.sheet.getRange(user.row,5).setValue("Stopped");
  return { stopped:true };
}
