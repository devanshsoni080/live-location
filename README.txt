LIVE LOCATION TRACKING - SETUP

FILES
- index.html: Upload this to your Vercel project's public root as index.html.
- Code.gs: Paste into Google Apps Script.
- README.txt: This setup guide.

GOOGLE APPS SCRIPT
1. Open script.google.com and create/open your Apps Script project.
2. Replace Code.gs with the supplied Code.gs.
3. Confirm SHEET_ID is the correct Google Sheet ID. It is currently set to:
   1dm1XZRWtPAUxVO5LuHakbrIM4lOJQfOisNocijmt-cU
4. Save, select setupSheets from the function list, and Run once. Authorize access.
5. Deploy > New deployment > Web app.
6. Execute as: Me
7. Who has access: Anyone
8. Deploy and copy the /exec URL.
9. In index.html, replace the API_URL value with your NEW /exec URL.
10. Upload index.html to Vercel and redeploy.

GOOGLE SHEETS TABS
- Users: latest status and latest known location for each user.
- Location_History: every successful GPS update is appended as a new row.

HOW TO USE
1. Open your Vercel site.
2. Enter a person's name and click Create Link.
3. Share the generated link with that person.
4. The person opens the link, reads the notice, presses Allow & Start Sharing, and grants GPS permission.
5. Admin dashboard refreshes every 30 seconds. Click See Location when coordinates are available.
6. The user can press Stop Sharing at any time.

IMPORTANT LIMITATIONS / PRIVACY
- GPS is collected only after the user chooses Allow & Start Sharing and grants browser permission.
- Use HTTPS (Vercel provides HTTPS).
- Browser watchPosition works while the page/browser is active. It is not reliable background tracking when the tab is closed, browser is suspended, or phone is locked. Continuous background tracking needs a native app and appropriate platform permissions.
- The simple API uses JSONP GET requests so a static Vercel page can communicate with Apps Script without browser CORS preflight. Keep the tracking token private; anyone with the link can use that user's tracking URL.
- This version has no admin login, as requested. Anyone who can open the admin page can see the users and locations. Restrict access at the hosting layer if needed.
