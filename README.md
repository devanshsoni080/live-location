# LiveTrack — Consent-based Location Sharing

Complete Google Apps Script + Google Sheets + Bootstrap 5.3.3 + jQuery AJAX project.

## Project files
- `Code.gs` — Apps Script API, admin session, user links and Google Sheets writes.
- `Index.html` — Admin login, create-link form, copy link, user list and Google Maps link.
- `Tracker.html` — Consent-based GPS sharing page with Start/Stop controls.

## Google Sheet
This project is configured for the Sheet ID already supplied:
`1dm1XZRWtPAUxVO5LuHakbrIM4lOJQfOisNocijmt-cU`

It creates these tabs automatically:

**Users**: User ID, Name, Token, Created At, Status, Last Seen, Latitude, Longitude, Accuracy, Maps URL.

**Location_History**: User ID, Name, Date & Time, Latitude, Longitude, Accuracy, Maps URL.

## Setup
1. Open the Google Sheet and select **Extensions → Apps Script**.
2. Replace `Code.gs` with the included `Code.gs` contents.
3. Add an HTML file named exactly `Index` and paste `Index.html` contents.
4. Add an HTML file named exactly `Tracker` and paste `Tracker.html` contents.
5. In `Code.gs`, replace `CHANGE_THIS_TO_A_PRIVATE_PASSWORD` with a strong private admin password. Never share it.
6. Save the project. Select `setupSheets` in the Apps Script function dropdown and click **Run**. Approve Google Sheets permissions. The two tabs will be created.
7. Select **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone** (or your required access setting)
8. Deploy and authorize. Open the deployed `/exec` URL.
9. Log in with your admin password, create a user by name, copy the generated tracking link and send it to that person.
10. On future code changes, select **Deploy → Manage deployments → Edit → New version → Deploy**. Refresh the `/exec` page.

## How it works
- Front-end calls use jQuery `$.ajax()` with JSONP (`dataType: "jsonp"`) to reach the Apps Script `/exec` endpoint.
- Admin password is exchanged for a temporary 6-hour server-side session. The password is not kept in browser storage; the session token is kept in `sessionStorage`.
- Each tracking URL has a unique User ID and secret token.
- After the user ticks consent and allows GPS, `watchPosition()` sends location fixes to the Apps Script API.
- The `Users` row is updated with the latest location; every received fix is appended to `Location_History`.
- Stop Sharing stops the browser watch and updates the user's status to `Stopped`.

## Important security and platform notes
- JSONP is used because it allows browser AJAX-style requests to Apps Script without a separate server/CORS setup. API parameters are carried in the URL. Do not share admin login URLs, browser/network logs, or tracking links. Treat each tracking link as a private secret.
- Use HTTPS and only share location with the person's clear consent. The user can stop sharing at any time.
- Browser GPS updates are best-effort. A fresh GPS fix every second is not guaranteed.
- Browser tracking may pause when the page is backgrounded, the phone is locked, the browser is suspended, or the page is closed. Reliable background tracking requires a properly disclosed native mobile app and platform permissions.
- For GPS to work, open the deployed HTTPS tracking link on the phone and allow location permission. The device's location services must be enabled.
- This project has been assembled but cannot be deployed or live-tested against your Google account from here. Test with one user and confirm both tabs receive data before using it widely.
