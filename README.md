# Optionicity Performance

Static page comparing weekly (Friday) Schwab account values against IBRX. It is
plain HTML/CSS/JS in `docs/`, with no build step.

`docs/data/performance.json` is written by the cron scripts in
`/home/ben/GIT/crons/optionicity_performance` every weekday at 16:30. See that
folder's README to run them by hand.

View locally:

```
cd docs && python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

This repo is public, so `performance.json` has no dollar amounts or account names.
Accounts appear as "Account ##" (last two digits of the account number), and each
account and the total are indexed to 100 on the first Friday. The page shows only
% changes, plus the IBRX share price. The real balances stay in the private crons
repo's gitignored `data/`.

`js/performance.js` was converted from `optionicity-app` `ui/src/performance.ts` and is
now edited directly.
