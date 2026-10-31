# ZenoBid QA suite

End-to-end checks that drive the real app in a real browser (Chromium via Playwright) and the real
HTTP / WebSocket API. They are what was used to test the app before release.

```bash
npm install                                   # installs playwright (the package only)
npx playwright install chromium               # one-time browser download
npm run build && npm start &                  # the app on http://localhost:8787
npm run qa                                    # runs everything (≈ 8 min)
```

Run against another address with `BASE=https://your-host npm run qa`. Screenshots land in `qa/out/`.
Run one script on its own with `node qa/qa-api.cjs`.

| Script | What it covers |
|---|---|
| `qa-api.cjs` | Input validation, wrong/missing keys, secrets never in other people's data, uploads (type/size), path traversal, WebSocket access, simultaneous bids, brute-force throttle |
| `qa-throttle.cjs` | What a person sees when they are throttled for wrong keys, and that valid keys are never blocked (takes ~1 min) |
| `qa-ui1.cjs` | Every page at 390 / 768 / 1024 / 1366 / 1920 px: no console errors, no sideways overflow; HTML-injection, very long / Arabic / Japanese names; 500 players × 32 teams |
| `qa-ui2.cjs` | Create-event form, teams (purse add/subtract/set, colour, logo), players (add, edit, photos, paste import, assign, delete), settings, share |
| `qa-ui3.cjs` | Wheel, bidding from phones, undo, calls, Space key, sold / take-back / no-sale, squad-full and budget limits, screen toggle, round 2, breaks |
| `qa-resilience.cjs` | Server restart mid-auction, WebSockets blocked (polling fallback), outage |
| `qa-late.cjs` | A screen opened halfway through a wheel spin or a break |
| `qa-multitab.cjs N` | N tabs in one browser, then a bid (the regression test for the "6 tabs" bug) |

The engine rules are also covered by `npm test`, including a randomised stress test
(`FUZZ_SESSIONS=6000 npm test` for a long run).
