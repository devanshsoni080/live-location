const SHEET_ID = "1dm1XZRWtPAUxVO5LuHakbrIM4lOJQfOisNocijmt-cU";
const USERS_SHEET = "Users";
const HEADERS = ["User ID", "Name", "Token", "Created At", "Status", "Last Seen"];

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  if (params.action) {
    return handleApi_(params);
  }

  const template = HtmlService.createTemplateFromFile("Index");
  template.apiUrl = ScriptApp.getService().getUrl();
  return template.evaluate()
    .setTitle("Live Location - Admin Panel")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(USERS_SHEET);

  if (!sheet) sheet = ss.insertSheet(USERS_SHEET);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  } else {
    const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length))
      .getValues()[0];
    HEADERS.forEach((header, i) => {
      if (current[i] !== header) sheet.getRange(1, i + 1).setValue(header);
    });
  }

  return "Users sheet is ready.";
}

function handleApi_(p) {
  let result;

  try {
    if (p.action === "ping") {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(USERS_SHEET);
      if (!sheet) throw new Error('Users tab not found. Run setupSheets() once.');
      result = { ok: true, message: "Google Sheets connected successfully" };
    } else if (p.action === "createUser") {
      result = createUser_(p.name);
    } else if (p.action === "getUsers") {
      result = getUsers_();
    } else {
      result = { ok: false, message: "Invalid action" };
    }
  } catch (err) {
    result = { ok: false, message: err.message || String(err) };
  }

  return outputResponse_(result, p.callback);
}

function createUser_(name) {
  name = String(name || "").trim();
  if (!name) return { ok: false, message: "Please enter user name." };
  if (name.length > 100) return { ok: false, message: "Name is too long." };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(USERS_SHEET);
    if (!sheet) {
      setupSheets();
      sheet = ss.getSheetByName(USERS_SHEET);
    }

    const userId = "USR-" + Utilities.getUuid().replace(/-/g, "").substring(0, 8).toUpperCase();
    const token = Utilities.getUuid().replace(/-/g, "");
    const createdAt = new Date();
    const status = "Offline";
    const lastSeen = "";

    sheet.appendRow([userId, name, token, createdAt, status, lastSeen]);

    // This is a reserved link for the future tracker page. GPS tracking is not enabled in this version.
    const baseUrl = ScriptApp.getService().getUrl();
    const trackingUrl = baseUrl + "?page=track&id=" +
      encodeURIComponent(userId) + "&token=" + encodeURIComponent(token);

    return {
      ok: true,
      message: "User created successfully.",
      user: {
        userId: userId,
        name: name,
        token: token,
        createdAt: createdAt.toISOString(),
        status: status,
        trackingUrl: trackingUrl
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function getUsers_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) throw new Error('Users tab not found. Run setupSheets() once.');

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return { ok: true, users: [], stats: { total: 0, online: 0, offline: 0 } };
  }

  const users = values.slice(1).filter(row => row[0]).map(row => ({
    userId: String(row[0]),
    name: String(row[1] || ""),
    token: String(row[2] || ""),
    createdAt: row[3] instanceof Date ? row[3].toISOString() : String(row[3] || ""),
    status: "Offline",
    lastSeen: row[5] instanceof Date ? row[5].toISOString() : String(row[5] || "")
  })).reverse();

  // Online status is not available until GPS sharing is implemented in the next phase.
  return {
    ok: true,
    users: users,
    stats: { total: users.length, online: 0, offline: users.length }
  };
}

function outputResponse_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function testSheetConnection() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Logger.log("Connected to: " + ss.getName());
  Logger.log("Users tab exists: " + Boolean(ss.getSheetByName(USERS_SHEET)));
}
