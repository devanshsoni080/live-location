// Live Location Tracking - Google Apps Script API
// 1) Set SHEET_ID below.
// 2) Run setupSheets() once.
// 3) Deploy as Web App: Execute as Me, Who has access: Anyone.

const SHEET_ID = "1dm1XZRWtPAUxVO5LuHakbrIM4lOJQfOisNocijmt-cU";
const USERS_TAB = "Users";
const HISTORY_TAB = "Location_History";

const USER_HEADERS = [
  "User ID", "Name", "Token", "Created At", "Status", "Last Seen",
  "Latitude", "Longitude", "Accuracy", "Maps URL", "Sharing"
];
const HISTORY_HEADERS = [
  "User ID", "Name", "Date & Time", "Latitude", "Longitude", "Accuracy", "Maps URL"
];

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  if (!p.action) {
    return ContentService.createTextOutput("Live Location API is working.")
      .setMimeType(ContentService.MimeType.TEXT);
  }
  let result;
  try {
    switch (p.action) {
      case "ping":
        result = ping_();
        break;
      case "createUser":
        result = createUser_(p.name);
        break;
      case "getUsers":
        result = getUsers_();
        break;
      case "updateLocation":
        result = updateLocation_(p);
        break;
      case "stopSharing":
        result = stopSharing_(p);
        break;
      default:
        result = { ok: false, message: "Unknown action." };
    }
  } catch (err) {
    result = { ok: false, message: err && err.message ? err.message : String(err) };
  }
  return output_(result, p.callback);
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const users = getOrCreateSheet_(ss, USERS_TAB, USER_HEADERS);
  const history = getOrCreateSheet_(ss, HISTORY_TAB, HISTORY_HEADERS);
  users.setFrozenRows(1);
  history.setFrozenRows(1);
  users.getRange(1, 1, 1, USER_HEADERS.length).setFontWeight("bold");
  history.getRange(1, 1, 1, HISTORY_HEADERS.length).setFontWeight("bold");
  return "Users and Location_History tabs are ready.";
}

function ping_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const users = ss.getSheetByName(USERS_TAB);
  const history = ss.getSheetByName(HISTORY_TAB);
  if (!users || !history) {
    return { ok: false, message: "Sheet tabs missing. Run setupSheets() once." };
  }
  return { ok: true, message: "Google Sheets connected successfully" };
}

function createUser_(name) {
  name = String(name || "").trim();
  if (!name) return { ok: false, message: "Please enter a user name." };
  if (name.length > 100) return { ok: false, message: "Name is too long." };

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(USERS_TAB);
  if (!sheet) throw new Error("Users tab missing. Run setupSheets() first.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = "USR-" + Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
    const token = Utilities.getUuid().replace(/-/g, "");
    const now = new Date();
    sheet.appendRow([id, name, token, now, "Offline", "", "", "", "", "", "No"]);
    return {
      ok: true,
      message: "User created.",
      user: { userId: id, name: name, token: token, createdAt: now.toISOString() }
    };
  } finally {
    lock.releaseLock();
  }
}

function getUsers_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(USERS_TAB);
  if (!sheet) throw new Error("Users tab missing. Run setupSheets() first.");
  const rows = sheet.getDataRange().getValues();
  const now = Date.now();
  const users = rows.slice(1).filter(r => r[0]).map(r => {
    const last = r[5] instanceof Date ? r[5].getTime() : (r[5] ? new Date(r[5]).getTime() : 0);
    const sharing = String(r[10] || "No") === "Yes";
    const online = sharing && last > 0 && (now - last) <= 120000;
    return {
      userId: String(r[0]), name: String(r[1] || ""), token: String(r[2] || ""),
      createdAt: toIso_(r[3]), status: online ? "Online" : "Offline",
      lastSeen: toIso_(r[5]), latitude: r[6] === "" ? null : Number(r[6]),
      longitude: r[7] === "" ? null : Number(r[7]), accuracy: r[8] === "" ? null : Number(r[8]),
      mapsUrl: String(r[9] || ""), sharing: sharing
    };
  }).reverse();
  const online = users.filter(u => u.status === "Online").length;
  return { ok: true, users: users, stats: { total: users.length, online: online, offline: users.length - online } };
}

function updateLocation_(p) {
  const userId = String(p.userId || "").trim();
  const token = String(p.token || "").trim();
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  const accuracy = Number(p.accuracy);
  if (!userId || !token) return { ok: false, message: "Missing user credentials." };
  if (!isFinite(lat) || !isFinite(lng) || !isFinite(accuracy)) {
    return { ok: false, message: "Invalid location values." };
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const users = ss.getSheetByName(USERS_TAB);
  const history = ss.getSheetByName(HISTORY_TAB);
  if (!users || !history) throw new Error("Sheet tabs missing. Run setupSheets() first.");

  const row = findUserRow_(users, userId, token);
  if (!row) return { ok: false, message: "Invalid user link." };
  const name = String(users.getRange(row, 2).getValue() || "");
  const now = new Date();
  const mapsUrl = "https://www.google.com/maps?q=" + encodeURIComponent(lat + "," + lng);

  users.getRange(row, 5, 1, 7).setValues([["Online", now, lat, lng, accuracy, mapsUrl, "Yes"]]);
  history.appendRow([userId, name, now, lat, lng, accuracy, mapsUrl]);

  return { ok: true, message: "Location saved.", lastSeen: now.toISOString() };
}

function stopSharing_(p) {
  const userId = String(p.userId || "").trim();
  const token = String(p.token || "").trim();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const users = ss.getSheetByName(USERS_TAB);
  if (!users) throw new Error("Users tab missing.");
  const row = findUserRow_(users, userId, token);
  if (!row) return { ok: false, message: "Invalid user link." };
  users.getRange(row, 5).setValue("Offline");
  users.getRange(row, 11).setValue("No");
  return { ok: true, message: "Location sharing stopped." };
}

function findUserRow_(sheet, userId, token) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const values = sheet.getRange(2, 1, last - 1, 3).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === userId && String(values[i][2]) === token) return i + 2;
  }
  return 0;
}

function getOrCreateSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  else sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sh;
}

function toIso_(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function output_(data, callback) {
  const body = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + body + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
