LIVETRACK - POINT 1 SETUP

Files:
- Code.gs
- Index.html

1. Open the Google Apps Script project connected to your Google Sheet.
2. Replace all Code.gs content with the supplied Code.gs.
3. Create/replace an HTML file named exactly Index and paste Index.html.
4. Save the project.
5. In the function dropdown select setupSheets and click Run.
6. Approve Google permissions. Confirm Users and Location_History tabs exist.
7. Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
   If there is no deployment yet: Deploy > New deployment > Web app.
8. Execute as: Me. Who has access: Anyone (only if you intentionally want the public admin page; it has no login as requested).
9. Open the Web App URL ending in /exec. Do not open the HTML file directly from your computer.
10. Add a test name and click Create Link. The page should show either a success message or a clear "NOT SAVED" error.

Important:
- This package completes Point 1 (Admin Panel and Google Sheets user records).
- Tracker page/location updates are Point 2 and are not implemented here yet.
- Because the admin page has no login, anyone who can access its URL may be able to create/view users. Keep the URL private.
