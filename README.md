# Live Location Tracker (Google Apps Script + Google Sheets)

## Files
- `Code.gs` — server-side Apps Script and Sheet operations
- `Index.html` — admin dashboard
- `Tracker.html` — consent-based user tracking page

## Setup
1. Open the Google Sheet:
   `https://docs.google.com/spreadsheets/d/1dm1XZRWtPAUxVO5LuHakbrIM4lOJQfOisNocijmt-cU/edit`
2. Open **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with the supplied `Code.gs`.
4. Create two HTML files in Apps Script named exactly `Index` and `Tracker`. Paste the matching HTML into each.
5. In `Code.gs`, change `ADMIN_PASSWORD` from the placeholder to a strong private password. Do not share it.
6. Save. Select `setupSheets` from the function dropdown and click Run. Approve the requested Google Sheets permissions. This creates `Users` and `Location_History` tabs.
7. Select **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone** (or the appropriate access option for your use case). Deploy and authorize.
8. Open the deployed `/exec` URL. Enter your admin password and click **Load users**. Create a test link and open it on a second phone.
9. After code changes, use **Deploy → Manage deployments → Edit → New version → Deploy**. Refresh the `/exec` page.

## Important
- Open the app through the deployed Apps Script `/exec` URL. Do not open the HTML files directly from your computer. The `google.script.run` bridge is provided by Apps Script HtmlService.
- If you already have an old deployment URL, update that deployment to a new version. The script generates user links from its current deployment URL.
- Location sharing is visible and consent-based. The recipient must tick the consent box and allow browser location access.
- Browser `watchPosition()` is best-effort. A new GPS fix is not guaranteed every second. Browser pages generally cannot reliably track after they are closed, suspended, or the phone is locked. Reliable background tracking requires a properly disclosed native mobile app and platform permissions.
- Treat tracking links as private. Anyone with a valid link can submit location data for that user.
