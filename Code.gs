/*************************************************
 * LIVETRACK - POINT 1: ADMIN PANEL + GOOGLE SHEETS
 *************************************************/

const SHEET_ID = "1dm1XZRWtPAUxVO5LuHakbrIM4lOJQfOisNocijmt-cU";
const USERS_SHEET = "Users";
const HISTORY_SHEET = "Location_History";

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};

  // JSONP API
  if (p.api) {
    return handleApi_(p);
  }

  // Tracker page is reserved for Point 2
  if (p.page === "track") {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:Arial;padding:24px">Tracker page will be added in Point 2.</div>'
    ).setTitle("Live Location Sharing");
  }

  // Admin panel: inject the currently deployed Web App URL automatically.
  const template = HtmlService.createTemplateFromFile("Index");
  template.apiUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle("LiveTrack Admin Panel")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/**
 * Run this function manually once from Apps Script.
 * It creates the required tabs and headers.
 */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const users = getOrCreateSheet_(ss, USERS_SHEET);
  const history = getOrCreateSheet_(ss, HISTORY_SHEET);

  const userHeaders = [
    "User ID", "Name", "Token", "Created At", "Status",
    "Last Seen", "Latitude", "Longitude", "Accuracy", "Maps URL"
  ];

  const historyHeaders = [
    "User ID", "Name", "Date & Time", "Latitude",
    "Longitude", "Accuracy", "Maps URL"
  ];

  ensureHeaders_(users, userHeaders);
  ensureHeaders_(history, historyHeaders);

  users.setFrozenRows(1);
  history.setFrozenRows(1);

  return "Setup successful. Users and Location_History tabs are ready.";
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  // If the first row is blank, insert headers. Do not overwrite existing data.
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const isBlank = firstRow.every(v => v === "" || v === null);
  if (isBlank) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function handleApi_(p) {
  try {
    let data;

    switch (String(p.api || "")) {
      case "createUser":
        data = createUser_(p.name);
        break;

      case "getUsers":
        data = getUsers_();
        break;

      case "ping":
        data = {
          message: "API connected",
          spreadsheet: SpreadsheetApp.openById(SHEET_ID).getName(),
          timestamp: new Date().toISOString()
        };
        break;

      default:
        throw new Error("Unknown API action: " + p.api);
    }

    return jsonpResponse_({ ok: true, data: data }, p.callback);

  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return jsonpResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err)
    }, p.callback);
  }
}

function createUser_(name) {
  name = String(name || "").trim();

  if (!name) throw new Error("Please enter a user name.");
  if (name.length > 100) throw new Error("Name must be 100 characters or less.");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(USERS_SHEET);
    if (!sheet) {
      throw new Error('Users tab not found. Run setupSheets() once from Apps Script.');
    }

    const appUrl = ScriptApp.getService().getUrl();
    if (!appUrl) {
      throw new Error("Web App URL is unavailable. Deploy this project as a Web App.");
    }

    const userId = "USR-" + Utilities.getUuid()
      .replace(/-/g, "").substring(0, 10).toUpperCase();
    const token = Utilities.getUuid().replace(/-/g, "");
    const createdAt = new Date();

    const trackingLink = appUrl +
      "?page=track&id=" + encodeURIComponent(userId) +
      "&token=" + encodeURIComponent(token);

    // Write the record in one operation.
    sheet.appendRow([
      userId, name, token, createdAt, "Offline",
      "", "", "", "", ""
    ]);
    SpreadsheetApp.flush();

    return {
      userId: userId,
      name: name,
      token: token,
      link: trackingLink,
      status: "Offline",
      createdAt: createdAt.toISOString()
    };

  } finally {
    lock.releaseLock();
  }
}

function getUsers_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) {
    throw new Error('Users tab not found. Run setupSheets() once from Apps Script.');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const now = new Date();

  return values
    .filter(row => row[0] || row[1])
    .map(row => {
      const lastSeen = row[5];
      let status = "Offline";

      if (lastSeen instanceof Date) {
        const age = now.getTime() - lastSeen.getTime();
        if (age >= 0 && age <= 120000) status = "Online";
      }

      const lat = row[6];
      const lng = row[7];

      return {
        userId: String(row[0] || ""),
        name: String(row[1] || ""),
        createdAt: toIso_(row[3]),
        status: status,
        lastSeen: toIso_(lastSeen),
        latitude: lat === "" || lat === null ? null : Number(lat),
        longitude: lng === "" || lng === null ? null : Number(lng),
        accuracy: row[8] === "" || row[8] === null ? null : Number(row[8]),
        mapsUrl: String(row[9] || "")
      };
    })
    .reverse();
}

function toIso_(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function jsonpResponse_(payload, callback) {
  callback = String(callback || "callback");

  // jQuery JSONP callback names may contain dots and brackets.
  if (!/^[A-Za-z_$][0-9A-Za-z_$.[\]]*$/.test(callback)) {
    callback = "callback";
  }

  const body = callback + "(" + JSON.stringify(payload) + ");";
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/**
 * Optional manual diagnostic. Run from Apps Script editor.
 */
function testSheetConnection() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const users = ss.getSheetByName(USERS_SHEET);
  const history = ss.getSheetByName(HISTORY_SHEET);

  const result = {
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    usersTab: users ? "Found" : "Not Found",
    historyTab: history ? "Found" : "Not Found",
    usersLastRow: users ? users.getLastRow() : 0,
    webAppUrl: ScriptApp.getService().getUrl()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
