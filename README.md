[README.md](https://github.com/user-attachments/files/33256572/README.md)
# Amanda's CRM

A simple customer tracker for Amanda's mobile home sales. It is a small web app
meant to live on her iPad and work without internet. It only captures and looks
up information: no automated emails, texts or reminders.

## What it does

- **Customers:** a list with search (name or phone) and a filter by stage.
- **Customer page:** all of a customer's details plus a dated notes log.
- **Add / edit:** one form for contact details, what they want, financing, the
  deal, and the next follow-up.
- **Follow-ups:** everyone with a follow-up date, earliest first, overdue ones
  marked. It only displays them; nothing is sent or scheduled.
- **Backup:** save a backup file, restore from one, or export a spreadsheet.

Stages: New lead, Showing, Application, Approved, Deposit, Closing, Delivered, Lost.

## Where the data lives

Customer data is stored inside the browser on the device where it is entered
(a built-in browser database called IndexedDB, under the name `amanda-crm`).
It is never sent to any server. The website only delivers the empty app.

Two consequences:

- Data entered on one device does not appear on another.
- Clearing Safari's website data, or deleting the app's home screen icon,
  erases the customers on that device. Backups are the only protection.

## Backup and restore

To back up:

1. Open the app and tap **Backup**.
2. Tap **Save backup file**.
3. On the iPad, choose **Save to Files** and pick a folder in iCloud Drive.

The file is named `amanda-crm-backup-` followed by the date. Do this regularly;
once a week is a reasonable habit, and always before changing iPads.

To restore:

1. Open the app and tap **Backup**.
2. Tap **Choose backup file** and pick the backup.
3. Confirm. This replaces everything currently in the app with the backup.

**Save spreadsheet file** makes a CSV that opens in Excel or Numbers. It is for
reading and printing only and cannot be used to restore.

Backup and spreadsheet files contain real customer information. Never upload
them to GitHub or any other public place.

## Putting it on the iPad

The app is served from GitHub Pages (a free website host). Only these files go
there: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`,
`icon-180.png`, `icon-512.png`.

On the iPad:

1. Open the app's web address in **Safari**.
2. Tap the Share button, then **Add to Home Screen**, then **Add**.
3. Always open the app from that home screen icon from then on.

After the first open, it works without internet. When the app's files are
updated on GitHub, the iPad picks up the new version the second time the app is
opened while online.

## Trying it on a Windows computer

1. Open this folder in File Explorer.
2. Click the address bar, type `powershell` and press Enter.
3. Run:

   ```
   python -m http.server 8765 --bind 127.0.0.1
   ```

4. Open <http://localhost:8765> in a browser.
5. To stop it, close the PowerShell window.

## Files

- `index.html`: the page.
- `styles.css`: how it looks.
- `app.js`: all the behaviour. The pipeline stages and the form fields are
  listed at the top of this file and can be changed there.
- `sw.js`: keeps a copy of the app on the device so it opens offline.
- `manifest.webmanifest`, `icon-180.png`, `icon-512.png`: the home screen name
  and icon.
