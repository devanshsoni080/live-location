const SHEET_ID = "1fmzWLyXqdvbpfKhuulRrJ6c2jEdRpOaueAkwQbRAT_";

// IMPORTANT: Change this before deployment. Keep it private.
const ADMIN_PASSWORD = "CHANGE_THIS_TO_A_LONG_PRIVATE_PASSWORD";

const USERS_SHEET = "Users";
const HISTORY_SHEET = "Location_History";

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || "admin";

  if (page === "track") {
    const template = HtmlService.createTemplateFromFile("Tracker");
    template.userId = String((e.parameter && e.parameter.id) || "");
    template.token = String((e.parameter && e.parameter.token) || "");
    return template.evaluate()
      .setTitle("Location Sharing")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Live Location Admin")
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
  }

  let history = ss.getSheetByName(HISTORY_SHEET);
  if (!history) history = ss.insertSheet(HISTORY_SHEET);
  if (history.getLastRow() === 0) {
    history.appendRow([
      "User ID", "Name", "Date & Time", "Latitude",
      "Longitude", "Accuracy", "Maps URL"
    ]);
    history.setFrozenRows(1);
  }

  return "Sheets are ready.";
}

function adminCheck_(password) {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD === "CHANGE_THIS_TO_A_LONG_PRIVATE_PASSWORD") {
    throw new Error("Admin password set nahi hai. Code.gs mein ADMIN_PASSWORD change karein.");
  }
  if (String(password || "") !== ADMIN_PASSWORD) {
    throw new Error("Incorrect admin password.");
  }
}

function createUser(name, password) {
  adminCheck_(password);
  name = String(name || "").trim();
  if (!name) throw new Error("Please enter a user name.");
  if (name.length > 80) throw new Error("Name is too long.");

  setupSheets();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(USERS_SHEET);
  const userId = "U" + Utilities.getUuid().replace(/-/g, "").substring(0, 10).toUpperCase();
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const createdAt = new Date();

  sheet.appendRow([userId, name, token, createdAt, "Not started", "", "", "", "", ""]);

  const baseUrl = ScriptApp.getService().getUrl();
  const link = baseUrl + "?page=track&id=" + encodeURIComponent(userId) +
               "&token=" + encodeURIComponent(token);

  return { userId: userId, name: name, link: link, createdAt: createdAt.toISOString() };
}

function getUsers(password) {
  adminCheck_(password);
  setupSheets();

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1).map(function(r) {
    return {
      userId: String(r[0] || ""),
      name: String(r[1] || ""),
      createdAt: r[3] ? new Date(r[3]).toISOString() : "",
      status: String(r[4] || "Not started"),
      lastSeen: r[5] ? new Date(r[5]).toISOString() : "",
      latitude: r[6] === "" ? null : Number(r[6]),
      longitude: r[7] === "" ? null : Number(r[7]),
      accuracy: r[8] === "" ? null : Number(r[8]),
      mapsUrl: String(r[9] || "")
    };
  }).reverse();
}

function saveLocation(userId, token, latitude, longitude, accuracy, clientTime) {
  userId = String(userId || "");
  token = String(token || "");
  latitude = Number(latitude);
  longitude = Number(longitude);
  accuracy = Number(accuracy);

  if (!userId || !token) throw new Error("Invalid tracking link.");
  if (!isFinite(latitude) || !isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180) {
    throw new Error("Invalid coordinates.");
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  let users = ss.getSheetByName(USERS_SHEET);
  let history = ss.getSheetByName(HISTORY_SHEET);
  if (!users || !history) throw new Error("Sheets are not initialized.");

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
    const mapsUrl = "https://www.google.com/maps?q=" + latitude + "," + longitude;
    const now = new Date();

    // Update the user's latest location row.
    users.getRange(rowNumber, 5, 1, 6).setValues([[
      "Online", now, latitude, longitude, accuracy || "", mapsUrl
    ]]);

    // Append every received point to the location history.
    history.appendRow([
      userId, userName, timestamp, latitude, longitude, accuracy || "", mapsUrl
    ]);

    return { ok: true, receivedAt: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}
