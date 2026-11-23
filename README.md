# Live Location Tracking System (Google Apps Script + Google Sheets)

## Included
- `Code.gs` — Apps Script backend
- `Index.html` — Admin panel: add a name, create/copy a unique link, list users, open latest location
- `Tracker.html` — recipient page: clearly explains sharing, requests browser location permission, and starts while page is active

## Setup

1. Open the Google Sheet with ID:
   `1fmzWLyXqdvbpfKhuulRrJ6c2jEdRpOaueAkwQbRAT_`
2. Open **Extensions → Apps Script**.
3. Replace the default code with `Code.gs`.
4. Add two HTML files in Apps Script:
   - `Index` (paste `Index.html`)
   - `Tracker` (paste `Tracker.html`)
5. In `Code.gs`, change:
   `ADMIN_PASSWORD = "CHANGE_THIS_TO_A_LONG_PRIVATE_PASSWORD"`
   to a strong private password. Do not share it.
6. Save. Run `setupSheets()` once from the Apps Script editor and approve the requested spreadsheet permissions.
7. Deploy → New deployment → Web app:
   - Execute as: **Me**
   - Who has access: **Anyone** (needed for recipients who open a link; admin actions still require the password)
8. Deploy and copy the Web App URL. Open it to use the admin panel.
9. Enter the admin password, add a user's name, create a link, and share that link with the recipient.

## Sheet tabs
- `Users`: one row per user, including their unique ID, secret token, status and latest location.
- `Location_History`: every location point received, tagged with User ID and timestamp.

## Important limitations
- Browser location requires HTTPS and the recipient's explicit location permission.
- This web version tracks only while the tracking page remains active. Closing the page, browser restrictions, battery saving, or locking the phone can pause/stop updates.
- A one-second interval is a target, not a guarantee. GPS hardware may not produce a new position every second, and Apps Script/Sheets quotas and latency limit high-volume writes.
- Reliable background tracking on Android and iOS requires a separately built native app, platform-specific background-location permissions, and clear ongoing user disclosure/consent.
- Anyone with a recipient's unique tracking link can cause that user's device to submit location while they use the page; treat links as private. If a link is exposed, delete that user's row/token in the `Users` sheet and create a replacement.
- The admin password is checked server-side in Apps Script. Still, the Apps Script deployment is public so tracking links can be opened without Google sign-in. Keep the admin password private.
