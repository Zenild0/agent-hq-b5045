# ZenoBid — the live team auction app

Run a proper player auction for your office league, club or hackathon — on Zoom or in the room.
Captains bid from their phones, an auctioneer calls *going once… twice… thrice…*, a giant **SOLD** stamp
slams down, and a live board shows every team's purse and squad.

It is sport-agnostic (cricket, football, kabaddi, esports, "who gets the best designer"…) and every
auction is its own isolated room, so the same deployment can serve any number of customers.

## What it does

| | |
|---|---|
| **Teams & purses** | Any number of teams (up to 32). Everyone starts with the same purse (e.g. ₹12 Cr); the admin can **add, subtract or set** any team's purse at any time, or change all of them at once between rounds. |
| **Bid steps** | Fully configurable tiers: e.g. *+5 L per bid, then +10 L once the bid reaches ₹1 Cr*. Add as many tiers as you like. |
| **Who comes next** | **Random spin** (a wheel spins, lands, and flashes the name), **auctioneer picks**, or **list order**. Spin from everyone or only one role (e.g. only Bowlers). |
| **The auctioneer** | One big button walks through *Going once → Going twice → Going thrice → SOLD*. A new bid resets the count. The next player only appears when the auctioneer clicks **Next**. Press **Space** to drive it from the keyboard. Can also bid on behalf of a captain who shouts on Zoom, undo a bid, take back a sale, or **send the player on screen back to the pool and reset the screen**. The admin can set **any player's status** (in pool / on the block / unsold / sold) from the Players tab at any time; moving a player out of "sold" refunds the team. |
| **The big screen** | One screen built to share on Zoom: the player's name on the left (about 45% of the width, with photo/description as you choose), a live **bidding war** on the right — a huge animated current bid, a ranked bar for every team showing what it has bid (👑 on the leader, "OUT" for teams that can't afford the next bid), ▲ +₹5L / ▼ −₹5L when a bid goes up or is undone, sparks on every bid, hype badges (🔥 Bidding war, ⚔️ head-to-head, 🏆 new record price), and a red edge glow that gets stronger through *going once → twice → thrice*. Underneath, **every team's full squad with the price paid for each player** (long squads scroll by themselves), with the team that just bought lighting up on SOLD. Between players it shows the latest buys. |
| **Live boards** | **Big screen** (share the tab on Zoom) with the player, current bid, leading team, SOLD / UNSOLD stamp and confetti. **Team board** with purse left, spent, squad and max bid for every team. The auctioneer chooses which one the room sees. |
| **What the audience sees** | Per event: show or hide the **photo**, **description**, **role** and **base price**. Name is always shown. Photos fall back to coloured initials. |
| **Excel import / export** | **Players tab → Import Excel** reads a `.xlsx` (Players + Teams sheets) or `.csv`, shows a preview, then adds teams, sets purses and places already-bought players. **Export Excel** downloads everything (players, teams, prices, purses spent/left). **Template** gives a blank file with a Team drop-down. Re-importing a name updates that player instead of duplicating. A ready-made file is in `templates/ZenoBid-import-template.xlsx`. |
| **Practice run** | Admin → *Run the auction* → **Start a practice run**. Everyone rehearses on their real screens with the real teams and players, under a yellow PRACTICE banner. The real auction is parked untouched and comes back exactly as it was when the admin clicks **Go live**. Team / player / purse editing is locked during practice so nothing can leak across. |
| **Captain strategy tab** | Each captain keeps a private plan: pick players and set the most they'd pay for each. It shows purse left vs. planned spend, warns when the plan is over budget, flags players other teams have bought, and shows "In your plan — up to …" when a target comes on the block. Nobody else can see it. |
| **Strategy break** | The auctioneer sets a time (2 / 5 / 10 / 15 min or any value) and starts a break. Every screen shows a countdown with the teams bought so far; captains are switched to their Strategy tab. The auctioneer can add time or end it early; it also ends by itself. |
| **Rounds** | Unsold players go back into the pool when you start the next round. Top up purses in between. |
| **Joining midway** | Bring in an auction that is already half done: paste a list with `team` + `price` columns (or use **Assign** on a player) and the price is deducted from that team's purse. Set a team's purse to whatever it has left. |
| **Squad rules** | Optional min/max squad size, plus a "keep money back for the minimum squad" rule so nobody can overspend into an impossible squad. |
| **Sound** | Bid pings, wood-block knocks for each call, a gavel on SOLD, and an optional spoken announcer ("Thunder Hawks, one crore twenty lakh"). Each browser opts in for itself. |
| **Currencies** | ₹ (lakh / crore), $ € £ (K / M) or plain points. Type amounts as `12cr`, `5L`, `250k`, `1.5m`. |

## Running an auction (5 minutes)

1. **Create** — click *Create an auction*, set the money, bid steps and what the audience sees.
2. **Teams** — add your captains with their purses. **Players** — add them one by one, paste a list from Excel / Google Sheets, and bulk-upload photos (name each file after the player, e.g. `aarav-mehta.jpg`). *No data yet? Click "Load sample teams & players".*
3. **Share** — the *Share & links* tab has everything: the 6-letter **join code**, the big-screen link, one personal link (or PIN) per captain, and the auctioneer link.
4. **Run** — the auctioneer opens their console, ticks **Sounds** / **Announcer**; you share the **Big screen** tab in Zoom (with *share computer audio*). Hit **Spin the wheel**.

Pasting a list — columns, in order (a header row is optional):

```
name   role   base price   description   photo URL   team   price
Aarav Mehta   Batter   20L   Opens the innings
Rohan Iyer    Bowler   25L   Death overs   https://…   Thunder Hawks   1.2cr     <- already bought
```

## Roles & links

| Who | Link | Access |
|---|---|---|
| Anyone watching | `/join` + code, or `/e/CODE/live` | read-only big screen |
| Captain | `/e/CODE/captain?k=PIN` | bid for their own team |
| Auctioneer | `/e/CODE/host?k=KEY` | run the auction |
| Admin | `/e/CODE/admin?k=KEY` | everything, incl. teams, players, settings |

Keys are generated when the auction is created and only the admin can see the others. There are no accounts.

## Develop

```bash
npm install
npm run dev        # API on :8787, web on http://localhost:5173
npm test           # engine + money tests
npm run typecheck
```

## Deploy

ZenoBid needs a **long-running Node process** (it streams live updates over Server-Sent Events), so use a
container / VM host such as Render, Railway, Fly.io or a VPS — not a serverless/edge platform.

```bash
npm run build && npm start               # serves the app + API on $PORT (default 8787)
# or
docker build -t zenobid . && docker run -p 8787:8787 -v zenobid-data:/data zenobid
```

* `DATA_DIR` (default `./data`) holds every auction (`events/*.json`) and uploaded photos (`uploads/`). **Mount a persistent disk there.**
* `PORT` (default `8787`), `MAX_EVENTS` (default `2000`).
* One server process = one source of truth, which is what keeps bids strictly ordered. Scale it vertically; run a single instance per data directory.

## Architecture

```
shared/    money formatting/parsing, bid-step + budget rules   (used by server AND browser)
server/    engine.ts   every auction rule lives here (validated, tested)
           index.ts    Express: REST commands, SSE stream, photo upload, static web app
web/       React + Tailwind: Home, Create, Admin, Auctioneer, Captain, Big screen
```

The server is authoritative: clients send intents (`bid`, `call`, `sold`…) and receive a full snapshot over SSE
after every change. The wheel's winner is chosen on the server and animated on every screen from the server's
clock, so the big screen and the captains' phones stop together.

## Before you sell it

This is a complete, working product but deliberately light on the commercial layer. For a paid multi-customer
service you would add: customer accounts + billing (e.g. a paid "event pass"), rate limiting on `/api/events`,
object storage for photos instead of local disk, and a database instead of JSON files if you expect thousands
of events. The engine and UI don't need to change for any of that.
