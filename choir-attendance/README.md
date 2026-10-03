# Children's Choir App

Attendance, behaviour remarks, a bobble-head leaderboard and achievers for a children's choir.
Created by Zenildo Dias. Zero dependencies (Node 18+).

```
cd choir-attendance
npm start                  # parents: http://localhost:3000   teacher: /teacher
CHOIR_PIN=1234 npm start   # optional: protect the teacher page with a PIN
npm test
```

## Your logo
Save your logo as **`public/logo.png`** (square PNG, at least 256×256). It appears in the page header and as the browser icon. Until then a 🎵 is shown.

## Teacher PIN (private)
The teacher pages are always PIN-protected, because they show children's details and parent codes. The first time the app starts it prints a **6-digit PIN in the black window**: note it down. Change it any time in **Settings → Teacher PIN**. (Or set your own with `CHOIR_PIN`.)

## For the teacher (`/teacher`)
- **Attendance:** one compact A–Z list with **P** / **A** / **ML** (medical leave) buttons, a **⋯** panel for behaviour remarks and a private note, and any date for **back-dated** entries.
- **Occasions** (Christmas, New Year, Maundy Thursday, Good Friday, Easter, Mother Mary's Feast, Communion, Confirmation, or your own name): create an occasion, tick which main-group children take part, and add **guests** who are not in the choir. Practices and the mass are marked from Attendance (Special practice / Special mass) for just those people, and points add to the leaderboard for main-group children. Guests appear only in their occasion; **⬆ Main group** moves a guest across when their remarks are good.
- **Children:** add one, or **Add many** (one name per line, optionally `Name, Standard`). Details per child: name, standard, year joined, contact, address, parent name and number, and a photo.
- **Parent access:** one link for everybody plus a private roll-number style code per child. Codes are hidden until you tap Show.
- **Leaderboard:** preview of what parents see, plus your private prize race (Easter in the first year, December afterwards).
- **Settings:** points, leave limit, late-points share, website address for parents, PIN.

## For parents (`/`)
- **One link for everyone.** Parents open it, see the **Leaderboard** and **Achievers** (names, photos and points only), tap **My child**, and type their child's code. A code opens only that child: attendance, and editing their own contact number, address and the parent-to-call name and number. Name, standard and photo are teacher-only. "Make a new code" cancels an old one.

## Rules
- **Year** = April 1 – March 31. Points: Saturday practice 1, Sunday mass 2, feast practice 1, feast mass 2 (all editable). Late = half points.
- **Leaves:** unexcused Saturday absences. Up to 5 are allowed. Going over never removes a child: they are flagged "over the leave limit" and you decide, per child, to **keep them in the choir** or mark them **not continuing this year** (hidden from the parent leaderboard; you can undo it). Counts start again from zero each April.
- **Medical:** mark a child **🏥 Medical** (with an optional reason: Sick, Hospitalised, Medical emergency). It never counts as a leave. You can fix past dates too, and the leave count updates. Feast practices and masses never count as leaves either.

Data lives in `data/db.json` and `data/photos/` (override with `CHOIR_DATA=/path/db.json`). Back these up, and use a persistent disk when hosting.

## Not done yet
- Full parent logins (the private code is used instead).
