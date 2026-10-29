# Release Notes

## 10-28
- Moved the Performance page here from `optionicity-app` `ui/performance.html`. It is now a static site in `docs/` with no build step: the TypeScript became `js/performance.js`, and the fonts are in `docs/fonts/`. It reads `data/performance.json`, written by `/home/ben/GIT/crons/optionicity_performance`, instead of `/api/performance`. The "Back to street" link is removed. Checked in a browser: renders the same data with no console errors apart from the missing favicon.
- Added `README.md`: how to view the site locally and where the data comes from.
- Made the page safe to publish: no dollar balances or account names. Accounts show as "Account ##" (last two digits of the account number). The Total Accounts tile shows % since the first Friday instead of the dollar total. The table and tooltips show % since the first Friday instead of balances. IBRX still shows its share price. Checked in a browser: the percentages match the previous version, with no console errors.
- `performance.json` now holds only the % values the page shows, worked out by the cron scripts. `js/performance.js` reads them directly instead of computing them from the indexed values. The page looks the same: checked in a browser at the same window size, the text matches exactly and the chart positions are within 0.001 px. `index.html` loads `js/performance.js?v=2`, so browsers don't pair a cached old script with the new data.
- The cron scripts in `/home/ben/GIT/crons/optionicity_performance` now commit and push `docs/data/performance.json` after every run.
