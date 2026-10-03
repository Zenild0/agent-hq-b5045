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

## Privacy: no PIN, teacher area is for this computer only
There is no PIN. The teacher pages (children's details and parent codes) open **only on the computer that runs the app**: `http://localhost:3000/teacher`. Anyone coming through the shared parent link, over the network or through a proxy is refused. Parents only ever see the leaderboard, achievers and, with a code, their own child. (If you later host the app online and want to reach the teacher pages from another device, start it with `CHOIR_PIN=yourpin`, and the teacher pages will ask for that PIN there.)

## For the teacher (`/teacher`)
- **Attendance:** one compact A–Z list with **P** / **A** / **ML** (medical leave) buttons, a **⋯** panel for behaviour remarks and a private note, and any date for **back-dated** entries.
- **Occasions** (Christmas, New Year, Maundy Thursday, Good Friday, Easter, Mother Mary's Feast, Communion, Confirmation, or your own name): create an occasion, tick which main-group children take part, and add **guests** who are not in the choir. Practices and the mass are marked from Attendance (Special practice / Special mass) for just those people, and points add to the leaderboard for main-group children. Guests appear only in their occasion; **⬆ Main group** moves a guest across when their remarks are good.
- **Children:** add one, or **Add many** (one name per line, optionally `Name, Standard`). Details per child: name, standard, year joined, contact, address, parent name and number, and a photo.
- **Parent access:** one link for everybody plus a short private code per child (4 characters, or choose your own like `1001` or `CC01`). Codes are hidden until you tap Show. Wrong guesses are limited to 5 per half hour per device; **Parent access → Unlock everyone now** clears any lockout instantly.
- **Hymns:** a library of hymns taught that are not in the book. Categories: Entrance, LHM, Gloria, Response, Acclamation, Offertory, Holy, Peace, Communion, Recessional. Add one, or **Add many** (pick a category, paste titles one per line, optionally `Title | https://link`). Each hymn can have a music **link** and/or an uploaded **recording** (MP3, M4A, WAV or OGG up to 25 MB), plus a short note. Recordings are stored in `data/hymns/`.
- **Leaderboard:** preview of what parents see, plus your private prize race (Easter in the first year, December afterwards).
- **Settings:** points, leave limit, late-points share, website address for parents.

## For parents (`/`)
- **Hymns tab:** parents open a category to listen to recordings or follow the music link (no code needed).
- **One link for everyone.** Parents open it, see the **Leaderboard** and **Achievers** (names, photos and points only), tap **My child**, and type their child's short code. A code opens only that child: attendance, and editing their own contact number, address and the parent-to-call name and number. Name, standard and photo are teacher-only. "Make a new code" cancels an old one.

## Rules
- **Year** = April 1 – March 31. Points: Saturday practice 1, Sunday mass 2, feast practice 1, feast mass 2 (all editable). Late = half points.
- **Leaves:** unexcused Saturday absences. Up to 5 are allowed. Going over never removes a child: they are flagged "over the leave limit" and you decide, per child, to **keep them in the choir** or mark them **not continuing this year** (hidden from the parent leaderboard; you can undo it). Counts start again from zero each April.
- **Medical:** mark a child **🏥 Medical** (with an optional reason: Sick, Hospitalised, Medical emergency). It never counts as a leave. You can fix past dates too, and the leave count updates. Feast practices and masses never count as leaves either.

Data lives in `data/db.json` and `data/photos/` (override with `CHOIR_DATA=/path/db.json`). Back these up, and use a persistent disk when hosting.

## Not done yet
- Full parent logins (the private code is used instead).
