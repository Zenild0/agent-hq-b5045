# IRCTC Assistant

Tell it which train. It waits for the 08:00 IST booking opening, fills the IRCTC forms, and hands you to the UPI
payment page. **You** type the password, captcha and OTP, and approve the payment in your UPI app.

```
"12951 from Mumbai Central to New Delhi on 25 Dec 3A"
        │
   parse → validate → compute opening time (08:00 IST, 60 days before the journey)
        │
   private browser window ──► you log in (password, captcha, OTP)  ◄── human gate 1
        │  waits, pre-fills at T-20s, searches at 08:00:00, retries politely
   train → class → date → passengers → UPI selected
        │
   review page: captcha                                              ◄── human gate 2
        │
   IRCTC payment page → UPI ID + approve in your UPI app             ◄── human gate 3
        │
   reads the PNR from the confirmation page → saved to history
```

## Read this first

* **IRCTC's terms restrict automated tools and it actively blocks bots** (it reported deleting ~3 crore IDs in 2025).
  This tool is built to stay low-risk — one session, human login/captcha/payment, no captcha solving, no Tatkal,
  polite retries (≥1.5 s apart, max 12) — but your IRCTC account is still **at your own risk**. If you want zero
  automation on the IRCTC site, use **alerts-only mode** (`--assist`): timer, 10-minute "log in now" alert, an
  "it's open" alert, and a copy-ready booking sheet.
* **The IRCTC selectors are unverified.** They live in `src/selectors.js`, written from knowledge of IRCTC's Angular
  site, and could not be tested against the live site (it needs a real account and captcha). If any step fails, the
  assistant does **not** crash — it tells you "YOUR TURN" for that one step, waits for you to do it by hand, and
  carries on from the next page. Rehearse first with `npm run demo`, then do a real run for a ticket you can afford
  to fumble, before relying on it for a rush booking.
* Your computer must stay **on, awake, online and logged in** at 08:00. This does not run in the cloud or "for"
  you while you sleep — nobody else can enter your password or captcha.

## Codes & authentication — what is needed, and who types it

| Thing | Who provides it | Does this app see/store it? |
|---|---|---|
| IRCTC user ID + password | **You**, typed into the real IRCTC page | **No.** The app never types into, reads, or logs those fields |
| Login captcha, review-page captcha | **You** | No. Never read, never OCR'd |
| OTP / mobile verification (if IRCTC asks) | **You** | No |
| Aadhaar-verified IRCTC account | **You**, once, on irctc.co.in. IRCTC has restricted opening-day booking to Aadhaar-authenticated users; the rules changed in Oct 2025 and Jan 2026 — check the current rule | No |
| UPI ID (VPA) and UPI PIN | **You**, on IRCTC's payment page / your UPI app | **No.** The app only clicks "BHIM/UPI" → "Pay & Book", then stops |
| Passenger names, ages, gender, berth, mobile | You, saved to `~/.irctc-assistant/profile.json` (mode 0600) | Yes — locally, non-secret |
| API keys / developer credentials | **None needed.** IRCTC has no public booking API for individuals | — |

Why this is enforceable and not just a promise (all covered by `npm test`):

* the storage layer **refuses to write** any key or value that looks like a password, OTP, card number, CVV, PIN,
  captcha, cookie, or UPI ID — from any code path;
* the browser context is **non-persistent** (no cookies/session saved) and Playwright tracing, HAR, video and
  screenshots are never enabled;
* an end-to-end test against a mock IRCTC asserts the driver made **zero** keystrokes into the password / OTP /
  captcha / UPI fields and that none of those values appear in logs;
* the web UI has no password field, binds to `127.0.0.1`, needs a per-run token, checks the Host header, sends no CORS headers.

## Setup

Requires Node 20+ and Google Chrome (or Edge). Nothing else.

```bash
cd irctc-assistant
npm install
npm run doctor        # checks Node, Chrome, clock sync, saved passengers
npm test              # 9 tests, incl. a full mock-IRCTC run (needs Chromium; set IRCTC_BROWSER_PATH if not auto-found)
npm run demo          # rehearse the full flow against a local fake IRCTC
```

Save who is travelling (or use the UI):

```bash
node bin/irctc-assistant.js profile add --name "Asha Rao" --age 31 --gender F --berth LB
node bin/irctc-assistant.js profile mobile 9876543210
node bin/irctc-assistant.js profile option acceptWaitlist off   # default: refuse RAC/WL, book only AVAILABLE
```

## Using it

```bash
npm start                                   # local control panel, prints a private http://127.0.0.1:… link
node bin/irctc-assistant.js book "12951 from NDLS to BCT on 25 Dec 3A"
node bin/irctc-assistant.js book "12951 from NDLS to BCT on 25 Dec 3A" --assist   # alerts only
node bin/irctc-assistant.js parse "…"       # how I understood it + when booking opens
```

Start it **about 15 minutes before 08:00**. It opens a private Chrome window on IRCTC; log in there. At 07:59:40 it
pre-fills the stations/class/quota, at 08:00:00 it sets the date and searches (IRCTC may need a second or two — it
retries). When it says **YOUR TURN** (also a beep + desktop notification), the browser is brought to the front.

Understood phrases: train number (5 digits); stations as IRCTC codes or names; date as `25 Dec`, `2026-12-25`,
`25/12/2026`, `tomorrow`, `in 60 days`; class `SL 3A 2A 1A 3E CC EC 2S` or words (`sleeper`, `third ac`); quota
`ladies` / `senior citizen` (default General). Tatkal / Premium Tatkal are deliberately not supported.

## Rules that live in `src/constants.js`

Advance reservation period (60 days), opening hour (08:00 IST), 6 passengers per ticket, name length. IRCTC has changed
these before — verify them and edit that one file if needed.

## Layout

```
bin/irctc-assistant.js   CLI          src/parse.js      "which train" → request
src/server.js + ui/      local panel  src/validate.js   rules + passenger checks
src/job.js               orchestrate  src/schedule.js   08:00 IST maths, precise wait, clock check
src/driver.js            Playwright   src/selectors.js  ALL IRCTC page knowledge (tune here)
src/store.js             safe storage src/mock/         fake IRCTC for demo + tests
```
