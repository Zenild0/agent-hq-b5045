# Children's Choir Attendance

Zero-dependency Node app (Node 18+) for taking choir attendance, with a read-only parent view and scoreboard.

```
cd choir-attendance
npm start                  # parents: http://localhost:3000   teacher: /teacher
CHOIR_PIN=1234 npm start   # optional: protect the teacher page with a PIN
npm test
```

Data is kept in `data/db.json` (override with `CHOIR_DATA=/path/db.json`). Back this file up / put it on a persistent disk when hosting.

## Rules built in

- **Year** = April 1 – March 31.
- **Points:** Saturday practice 1, Sunday mass 2. A present child marked *Late* earns half (configurable).
- **Leaves:** an unexcused absence from Saturday practice is a leave. Up to 5 are allowed; the 6th puts the child out for the rest of the year (flagged, and counted from zero again next April). *Sick / hospital* is excused and never counts.
- **Prize scoreboard:** first year ends at **Easter**; every later year at **31 December**. Children who are out are shown but not ranked. A monthly board is shown too.
- **Remarks:** per child per session: Late, Not paying attention, Book incomplete, Talking / disruptive, Well behaved, Helped others (visible to parents), plus a private note (teacher only).

Points, leave limit, whether Sunday absences count, and the first year are editable on the Settings tab.

## Not done yet

- Per-parent logins: today anyone with the link can view every child (the parent page is read-only). The optional `CHOIR_PIN` only protects the teacher page.
