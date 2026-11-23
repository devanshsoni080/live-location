const SHEET_ID = "1dm1XZRWtPAUxVO5LuHakbrIM4lOJQfOisNocijmt-cU";

// CHANGE THIS to your own private password before deployment.
const ADMIN_PASSWORD = "CHANGE_THIS_TO_A_PRIVATE_PASSWORD";

const USERS_SHEET = "Users";
const HISTORY_SHEET = "Location_History";

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.page === "track") {
    const template = HtmlService.createTemplateFromFile("Tracker");
    template.userId = String(params.id || "");
    template.token = String(params.token || "");
    return template.evaluate()
      .setTitle("Location Sharing")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Live Location Tracker - Admin")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  let users = ss.getSheetByName(USERS_SHEET);
  if (!users) users = ss.insertSheet(USERS_SHEET);
  if (users.getLastRow() === 0) {
    users.appendRow([
      "User ID", "Name", "Token", "Created At", "Status",
      "Last Seen", "Latitude", "Longitude", "Accuracy", "Maps URL"
    ]);
    users.setFrozenRows(1);
    users.getRange(1, 1, 1, 10).setFontWeight("bold");
  }

  let history = ss.getSheetByName(HISTORY_SHEET);
  if (!history) history = ss.insertSheet(HISTORY_SHEET);
  if (history.getLastRow() === 0) {
    history.appendRow([
      "User ID", "Name", "Date & Time", "Latitude",
      "Longitude", "Accuracy", "Maps URL"
    ]);
    history.setFrozenRows(1);
    history.getRange(1, 1, 1, 7).setFontWeight("bold");
  }

  return "Users and Location_History tabs are ready.";
}

function adminCheck_(password) {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD === "CHANGE_THIS_TO_A_PRIVATE_PASSWORD") {
    throw new Error("Please set your private ADMIN_PASSWORD in Code.gs and deploy a new version.");
  }
  if (String(password || "") !== ADMIN_PASSWORD) {
    throw new Error("Incorrect admin password.");
  }
}

function createUser(name, password) {
  adminCheck_(password);
  name = String(name || "").trim();
  if (!name) throw new Error("Please enter a user name.");
  if (name.length > 80) throw new Error("Name must be 80 characters or fewer.");

  setupSheets();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(USERS_SHEET);
  const userId = "U" + Utilities.getUuid().replace(/-/g, "").substring(0, 10).toUpperCase();
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const createdAt = new Date();

  sheet.appendRow([userId, name, token, createdAt, "Not started", "", "", "", "", ""]);

  const baseUrl = ScriptApp.getService().getUrl();
  if (!baseUrl) throw new Error("Web App URL not found. Deploy this project as a Web App first.");
  const link = baseUrl + "?page=track&id=" + encodeURIComponent(userId) +
    "&token=" + encodeURIComponent(token);

  return {
    userId: userId,
    name: name,
    link: link,
    createdAt: createdAt.toISOString()
  };
}

function getUsers(password) {
  adminCheck_(password);
  setupSheets();

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1).filter(r => r[0]).map(r => ({
    userId: String(r[0] || ""),
    name: String(r[1] || ""),
    createdAt: toIso_(r[3]),
    status: String(r[4] || "Not started"),
    lastSeen: toIso_(r[5]),
    latitude: r[6] === "" || r[6] == null ? null : Number(r[6]),
    longitude: r[7] === "" || r[7] == null ? null : Number(r[7]),
    accuracy: r[8] === "" || r[8] == null ? null : Number(r[8]),
    mapsUrl: String(r[9] || "")
  })).reverse();
}

function toIso_(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function saveLocation(userId, token, latitude, longitude, accuracy, clientTime) {
  userId = String(userId || "");
  token = String(token || "");
  latitude = Number(latitude);
  longitude = Number(longitude);
  accuracy = Number(accuracy);

  if (!userId || !token) throw new Error("Invalid tracking link.");
  if (!isFinite(latitude) || !isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Invalid GPS coordinates.");
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const users = ss.getSheetByName(USERS_SHEET);
  const history = ss.getSheetByName(HISTORY_SHEET);
  if (!users || !history) throw new Error("Run setupSheets() first.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const lastRow = users.getLastRow();
    if (lastRow < 2) throw new Error("Tracking link not found.");

    const rows = users.getRange(2, 1, lastRow - 1, 10).getValues();
    let rowNumber = -1;
    let userName = "";

    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === userId && String(rows[i][2]) === token) {
        rowNumber = i + 2;
        userName = String(rows[i][1] || "");
        break;
      }
    }
    if (rowNumber === -1) throw new Error("Invalid or expired tracking link.");

    const timestamp = clientTime ? new Date(clientTime) : new Date();
    const safeTimestamp = isNaN(timestamp.getTime()) ? new Date() : timestamp;
    const mapsUrl = "https://www.google.com/maps?q=" + latitude + "," + longitude;
    const now = new Date();

    users.getRange(rowNumber, 5, 1, 6).setValues([
      ["Online", now, latitude, longitude, isFinite(accuracy) ? accuracy : "", mapsUrl]
    ]);

    history.appendRow([
      userId, userName, safeTimestamp, latitude, longitude,
      isFinite(accuracy) ? accuracy : "", mapsUrl
    ]);

    return { ok: true, receivedAt: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}
