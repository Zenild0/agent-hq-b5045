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

## For the teacher (`/teacher`)
- **Attendance:** one compact list of all children with **P** / **A** / **ML** (medical leave) buttons, plus a behaviour-remarks dropdown and a private note. Pick any date for **back-dated** entries (quick buttons: Today, Last Saturday, Last Sunday). Tap a child's name to open their details.
- **Occasions:** feast practices and masses (Christmas, New Year, Maundy Thursday, Good Friday, Easter, Mother Mary's Feast, Communion, Confirmation, or "Other…"). Each practice earns points. The Occasions tab shows who attended each practice and mass.
- **Children:** add one child, or **Add many** (paste one name per line, optionally `Name, Standard`). **Parent links** lists every child's private link with Copy / WhatsApp buttons. Details per child: name, standard, year joined, contact, address, parent name and number, and a photo (take it with the phone camera or choose a file).
- **Leaderboard:** preview of what parents see, plus your private prize race (Easter in the first year, December afterwards). Parents never see prize information.
- **Settings:** points, leave limit, late-points share, whether Sunday absences count.

## For parents (`/`)
- **Leaderboard** (public, names, photos and points only) with month / year views, and **Achievers**: monthly winners (ties all shown) and yearly winners.
- **My child** is private. Each child has a private code (shown in the child's details; share it as a link or on WhatsApp). With it, parents see only their own child: photo, name, standard, attendance, and can edit contact number, address and the parent-to-call name and number. Name, standard and photo are teacher-only. "Make a new code" cancels an old link.

## Rules
- **Year** = April 1 – March 31. Points: Saturday practice 1, Sunday mass 2, feast practice 1, feast mass 2 (all editable). Late = half points.
- **Leaves:** unexcused Saturday absences. Up to 5 are allowed. Going over never removes a child: they are flagged "over the leave limit" and you decide, per child, to **keep them in the choir** or mark them **not continuing this year** (hidden from the parent leaderboard; you can undo it). Counts start again from zero each April.
- **Medical:** mark a child **🏥 Medical** (with an optional reason: Sick, Hospitalised, Medical emergency). It never counts as a leave. You can fix past dates too, and the leave count updates. Feast practices and masses never count as leaves either.

Data lives in `data/db.json` and `data/photos/` (override with `CHOIR_DATA=/path/db.json`). Back these up, and use a persistent disk when hosting.

## Not done yet
- Full parent logins (the private code is used instead). Teacher access is the optional `CHOIR_PIN`.
