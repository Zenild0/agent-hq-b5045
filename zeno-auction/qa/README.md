# ZenoBid QA suite

End-to-end checks that drive the real app in a real browser (Chromium via Playwright) and the real
HTTP / WebSocket API. They are what was used to test the app before release.

```bash
npm install                                   # installs playwright (the package only)
npx playwright install chromium               # one-time browser download
DEV_KEY=qa-developer-key-1234 npm start &     # (after npm run build) the app on http://localhost:8787 — DEV_KEY switches on the payment / developer features the last two suites test
npm run qa                                    # runs everything (≈ 8 min)
```

Run against another address with `BASE=https://your-host npm run qa`. Screenshots land in `qa/out/`.
Run one script on its own with `node qa/qa-api.cjs`.

| Script | What it covers |
|---|---|
| `qa-api.cjs` | Input validation, wrong/missing keys, secrets never in other people's data, uploads (type/size), path traversal, WebSocket access, partial live updates, caching headers, `/healthz`, export / restore / delete, simultaneous bids, brute-force throttle |
| `qa-throttle.cjs` | What a person sees when they are throttled for wrong keys, and that valid keys are never blocked (takes ~1 min) |
| `qa-ui1.cjs` | Every page at 390 / 768 / 1024 / 1366 / 1920 px: no console errors, no sideways overflow; HTML-injection, very long / Arabic / Japanese names; 500 players × 32 teams |
| `qa-ui2.cjs` | Create-event form, teams (purse add/subtract/set, colour, logo), players (add, edit, photos, paste import, assign, delete), settings, share |
| `qa-ui3.cjs` | Wheel, bidding from phones, undo, calls, Space key, sold / take-back / no-sale, squad-full and budget limits, screen toggle, round 2, breaks |
| `qa-resilience.cjs` | Server restart mid-auction, WebSockets blocked (polling fallback), outage |
| `qa-late.cjs` | A screen opened halfway through a wheel spin or a break |
| `qa-ui4.cjs` | Download the whole auction file, restore it from the create screen (and clear messages for wrong files), delete with typed confirmation, big screen told "deleted" |
| `qa-pay.cjs` | Going live: locked until paid or granted, practice always free, UPI reference request, developer approve / reject / grant / take back, live unlock on the admin screen, signed unlock surviving "Restore from file" (forgeries ignored), price 0 = free, developer-key throttle. Needs `DEV_KEY` on the server |
| `qa-ui5.cjs` | Theme picker (29 themes), light/dark switch (per device, organiser default), brand logo / banner / "Powered by ZenoBid", team-list sorting (captain's own, auctioneer's for the big screen), unlock dialog with QR, developer page, Terms page. Needs `DEV_KEY` |
| `qa-multitab.cjs N` | N tabs in one browser, then a bid (the regression test for the "6 tabs" bug) |

The engine rules are also covered by `npm test`, including a randomised stress test
(`FUZZ_SESSIONS=6000 npm test` for a long run).

Server-kit rehearsals (no root, no systemd, nothing outside a temp folder):

```bash
bash deploy/google-cloud/test/update-backup.test.sh   # update, rollback, bad-version memory, live-auction deferral, backups
bash deploy/google-cloud/test/install.test.sh         # build → publish → install → run → backup → restore (≈ 1 min; needs a clean git tree)
```
