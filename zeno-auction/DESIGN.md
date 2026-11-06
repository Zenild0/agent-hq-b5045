# ZenoBid design system — "Midnight Gold"

> Premium like a private bank. Alive like a trading floor. Fun like a final over.

ZenoBid is used for sport, esports, talent drafts, charity galas and hackathons, so the look is
deliberately **industry-neutral**: no mascots, no sport clip-art. The excitement comes from
*motion, tempo and typography*, not from decoration.

## Principles

1. **Money is gold.** Every amount, price and "winning" moment uses champagne gold or the leading team's colour. Nothing else is allowed to compete with it.
2. **The room has a heartbeat.** One shared tempo (BPM) drives the pulse line, the beating bid button and the glow — calm when quiet, racing in a bidding war. Motion always *means* something.
3. **Cinematic on the big screen, calm in the console.** Stage surfaces (big screen, captain phone) are bold and dramatic; admin surfaces are quiet, dense and dashboard-like.
4. **One glance, one fact.** Each screen answers one question: who is up, what is the bid, who is winning, what can I do now.
5. **Never trap or surprise.** Big, honest states (loading skeletons, "Connection lost", "Too many wrong keys"), reduced-motion support, visible focus, labelled controls.

## Colour

| Token | Hex | Used for |
|---|---|---|
| `ink-950 … 500` | `#040918 → #2a4488` | midnight-navy surfaces, deepest to lightest |
| `royal` | `#2f6bff` (300 `#8fb0ff`) | focus, energy, labels, links |
| `gold` | `#f2b84b` (soft `#ffe29a`, deep `#c98a12`) | money, primary actions, winning |
| `pearl` | `#f4f7ff` | text on dark |
| `hot` | `#ff5c7a` | outbid, drops, "going thrice", danger |
| `cyan` | `#5cc8ff` | cool highlights |

Gradients: `--gold-grad` (primary buttons, active tabs, icon tiles) and `--royal-grad`.
Team colours are data (chosen per team) and are the only place bright colour appears freely.

## Type

| Role | Face | Where |
|---|---|---|
| Display, numbers | **Sora** 600–800 | headings, prices, KPI values (tabular figures) |
| Cinematic | **Barlow Condensed** 600–800 | player names, SOLD / UNSOLD stamps, "going once…" |
| Body | **Inter** 400–700 | everything else |

Figures use tabular lining numerals so prices never jitter as they change.

## Surfaces

`.card` is a glass panel: faint blue top-light, 1 px blue hairline, deep soft shadow, backdrop blur.
The page behind is navy with a blue aurora, a gold glow and a faint engineering grid that fades out.
Radius scale: 12 → 16 → 22 → 26 px.

## Motion & tempo

* **Tempo** (`lib/tempo.ts`): idle ≈ 58 BPM → +11 BPM per bid in the last 15 s → 132 / 150 / 172 BPM for going once / twice / thrice → settles to 46 BPM after the hammer. It decays smoothly when bidding goes quiet.
* `--beat` (seconds per beat) is set on the screen root; `animate-beat` (a real *lub-dub*), `animate-ecg` and `animate-ping` all follow it.
* Signature moments: number *bump* on a new bid, red *drop* when a bid is undone, sparks, edge-glow that intensifies through the calls, SOLD *slam* + confetti, roulette with chasing rim lights, live market tape.
* `prefers-reduced-motion` switches all of it off.

## Signature components

| Component | Purpose |
|---|---|
| `Heartbeat` / `HeartPill` | ECG trace + "♥ 128 BPM · HOT" |
| `Tape` | stock-ticker of the latest sales |
| `Arena` | the big screen: player card, bidding war, team squads |
| `PurseRing` | captain's circular purse gauge |
| `AuctionPreview` | live miniature of the big screen while creating an auction |
| `CodeBoxes` | one-time-code style input for auction codes and PINs |
| `HeroDemo` | self-playing mini auction on the landing page |

## Accessibility

Visible gold focus ring, labels linked to every input, `aria-pressed` / `aria-selected` on toggles and tabs,
live-region toasts, loading skeletons with `aria-busy`, per-tab titles ("Royal Rockets · Captain"),
contrast ≥ 4.5:1 for body text on navy, reduced-motion support.

## Voice (the announcer)

Defaults to a clear **female English voice** (Indian English first), ranked from the voices installed on the
computer (`shared/voice.ts`); a picker lets anyone choose another. Each browser decides for itself whether to speak.
