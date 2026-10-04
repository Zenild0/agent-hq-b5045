# Children's Choir ZD

Attendance, behaviour remarks, a bobble-head leaderboard and achievers for a children's choir.
Created by Zenildo Dias. Zero dependencies (Node 18+).

```
cd choir-attendance
npm start                  # parents: http://localhost:3000   teacher: /teacher
npm test
```

## Your logo
The logo is `public/logo.png` (header) with app icons `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `apple-touch-icon.png`. To change it, replace those files (keep the names).

## Make it feel like an app
- **Teacher (Windows):** double-click **`start-choir.bat`** in the `choir-attendance` folder. It starts the app and opens the teacher page. Right-click it, **Send to → Desktop (create shortcut)** for a desktop icon.
- **Installable:** in Chrome or Edge, open the page and choose **Install** (the icon at the right of the address bar, or ⋮ → *Cast, save and share → Install page as app*). Parents can do the same on a phone: ⋮ → **Add to Home screen / Install app**. The teacher page installs separately as "Choir Teacher".

## Putting it online (phone, parents, laptop closed)
See **[HOSTING.md](HOSTING.md)** for three options: free from your own laptop with the lid closed (Tailscale Funnel; run `start-choir-online.bat`), an always-on cloud server (Render), or a free Google cloud server with your own domain ([deploy/GOOGLE-CLOUD.md](deploy/GOOGLE-CLOUD.md)). Online, set `CHOIR_PIN` and `CHOIR_PUBLIC=1` so the teacher pages need your PIN; **Settings → Download backup / Restore** moves your data across.

## Privacy: no PIN, teacher area is for this computer only
There is no PIN. The teacher pages (children's details and parent codes) open **only on the computer that runs the app**: `http://localhost:3000/teacher`. Anyone coming through the shared parent link, over the network or through a proxy is refused. Parents only ever see the leaderboard, achievers and, with a code, their own child. (If you later host the app online and want to reach the teacher pages from another device, start it with `CHOIR_PIN=yourpin`, and the teacher pages will ask for that PIN there.)

## For the teacher (`/teacher`)
- **Attendance:** one compact A–Z list with **P** / **A** / **ML** (medical leave) buttons, a **⋯** panel for behaviour remarks and a private note, and any date for **back-dated** entries.
- **Schedule:** the usual practice (every Saturday, 7 pm, Indian time) is added automatically with a note for parents ("Carry your books"). You only change the exceptions: cancel a day, change a time, or add a special day (feast rehearsal) with its own time and note.
- **Occasions** (Christmas, New Year, Maundy Thursday, Good Friday, Easter, Mother Mary's Feast, Communion, Confirmation, or your own name): create an occasion, tick which main-group children take part, and add **guests** who are not in the choir. Practices and the mass are marked from Attendance (Special practice / Special mass) for just those people, and points add to the leaderboard for main-group children. Guests appear only in their occasion; **⬆ Main group** moves a guest across when their remarks are good.
- **Children:** add one, or **Add many** (one name per line, optionally `Name, Standard`). Details per child: name, standard, year joined, contact, address, parent name and number, and a photo.
- **Parent access:** one link for everybody plus a short private code per child (4 characters, or choose your own like `1001` or `CC01`). Codes are hidden until you tap Show. Wrong guesses are limited to 5 per half hour per device; **Parent access → Unlock everyone now** clears any lockout instantly.
- **Hymns:** a library of hymns taught that are not in the book. Categories: Entrance, LHM, Gloria, Response, Acclamation, Offertory, Holy, Peace, Communion, Recessional. Add one, or **Add many** (pick a category, paste titles one per line, optionally `Title | https://link`). Each hymn can have a music **link** and/or an uploaded **recording** (MP3, M4A, WAV or OGG up to 25 MB), plus a short note. Recordings are stored in `data/hymns/`.
- **Leaderboard:** preview of what parents see, plus your private prize race (Easter in the first year, December afterwards).
- **Vocals for you:** the teacher area has its own **🎤 Vocals** tab: everything is open and free for you, and your progress stays on that device only.
- **Vocals game switch:** in Settings, tick "Vocals game is on for parents" when you are ready. It is off by default, so nothing changes for parents until you turn it on.
- **Settings:** points, leave limit, late-points share, website address for parents.

## For parents (`/`)
- **Home:** the next practice with your note, a folded "Practice days" list (past days coloured green for present and red for absent or medical once the child's code is entered), the child's points with day-by-day remarks, then the leaderboard. A small Online/Offline label shows the connection. **Offline:** the parent pages open without signal and show what the phone last loaded (schedule, remarks, leaderboard, hymn titles and lyrics). It always tries the internet first. "Not your child? Switch" clears the saved copy. The teacher area and hymn recordings need internet.
- **Hymns tab:** parents open a category to listen to recordings or follow the music link (no code needed).
- **One link for everyone.** Parents open it, see the **Leaderboard** and **Achievers** (names, photos and points only), tap **My child**, and type their child's short code. A code opens only that child: attendance, and editing their own contact number, address and the parent-to-call name and number. Name, standard and photo are teacher-only. "Make a new code" cancels an old one.

## Vocals game (parents, with the child's code)
- **Free and paid:** Level 1 is free for every child, and the Warm-up is free for 3 sessions (one per day), then it is part of the full game. Level 2 onwards, the daily challenge and the weekly boards are the "full game" (default ₹500 for one year; after 365 days the child needs to be renewed. Progress and scores are always kept). Parents pay you directly (mobile number or UPI ID, set in Settings), then you unlock their child in Children → the child → Vocals game. Nothing is charged by the app, so there are no gateway fees or extra costs.
- A **🎤 Vocals** tab appears for parents when you switch the game on. Twelve levels from Little Lark to Legend, each with three stages (Practice, Challenge, Showdown), unlocked one at a time (clear 70% to pass). The start screen shows your journey on a piano: each cleared level lights a key, and your title (Beginner, Amateur, Pro, Expert, Legend) follows the highest level cleared. Levels have their own screen. Levels 1 to 4 have no countdown: a child can keep trying a note, go back and forward between the notes (Back, Next, or tap the dots), and press Finish round when done; the score is the total time spent, and from level 5 every note has a countdown. Only the Stage 3 showdown counts for the weekly board. a **Today's Legend challenge** (one try a day, the same for everyone, Indian time), a **weekly leaderboard per level**, **badges**, and a **Warm-up** room with major and minor chords, scales and a live tuner.
- After each round the app gives earned praise (Well done, You Rock, U R A Star, Perfect pitch) based on the stars, accuracy, hints, a new personal best and the place on the board; a round that is not passed gets encouragement and no stars. Every stage keeps each child's best three scores with the date only (no time of day).
- The phone listens to the voice live and throws the sound away. Nothing is recorded, stored or sent. The server keeps only small numbers per child (levels cleared, best scores, badges), about a few hundred bytes each, so there is no extra cost.
- Adults can play too: add them in Children (as guests if you want them off the main leaderboard).
- The hidden page `/voice-test.html` is the original test version with every level open and no scores.

## Photos
- Parents can add or change their child's photo on the **My child** page (take a photo or choose one). It takes two quick steps: first the **square profile photo**, then (optionally) just the **face** for the leaderboard. Each opens in a frame to drag and zoom. The profile photo is used on profiles and lists; the leaderboard bobble-heads use the separate face crop, so they look like real bobble-heads. The full photo is never stored, only the two small crops (about 600 and 300 pixels). The teacher uses the same two steps. Backups include both pictures.

## Rules
- **Year** = April 1 – March 31. Points: Saturday practice 1, Sunday mass 2, feast practice 1, feast mass 2 (all editable). Late = half points.
- **Leaves:** unexcused Saturday absences. Up to 5 are allowed. Going over never removes a child: they are flagged "over the leave limit" and you decide, per child, to **keep them in the choir** or mark them **not continuing this year** (hidden from the parent leaderboard; you can undo it). Counts start again from zero each April.
- **Medical:** mark a child **🏥 Medical** (with an optional reason: Sick, Hospitalised, Medical emergency). It never counts as a leave. You can fix past dates too, and the leave count updates. Feast practices and masses never count as leaves either.

Data lives in `data/db.json` and `data/photos/` (override with `CHOIR_DATA=/path/db.json`). Back these up, and use a persistent disk when hosting.

## Not done yet
- Full parent logins (the private code is used instead).
