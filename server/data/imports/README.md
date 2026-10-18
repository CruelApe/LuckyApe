# Imported draw history

Drop your own results here and the server will use them **instead of** the live feed
(source order is `import -> thelott -> sample`, see `.env.example`). Imported draws go through the
same strict validation as live data, and a bad row stops the import with the file and line number.

Name the file after the game slug: `tattslotto`, `weekday-windfall`, `oz-lotto`, `powerball`,
`super-66` (extension `.json` or `.csv`; JSON wins if both exist).

## CSV

Header row required, columns in any order, names are case-insensitive. `#` lines are comments.

```csv
date,draw,n1,n2,n3,n4,n5,n6,s1,s2
2026-10-17,4721,32,11,22,30,15,1,43,13
2026-10-10,4719,16,41,15,2,33,43,28,5
```

| Column        | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `date`        | `YYYY-MM-DD`                                                       |
| `draw`        | Draw number (optional)                                             |
| `n1`…`nK`     | Main numbers, as many as the game draws (e.g. 7 for Oz Lotto)     |
| `s1`…`sM`     | Supplementary numbers (not for Powerball / Super 66)               |
| `powerball`   | The Powerball number (Powerball only)                              |

Super 66 uses `n1`…`n6` for the six digits **in drawn order**.

## JSON

An array of draws, or `{ "draws": [...] }`:

```json
[
  { "drawNumber": 4721, "date": "2026-10-17", "main": [1, 11, 15, 22, 30, 32], "supplementary": [13, 43], "powerball": null }
]
```

Files in this folder are yours: only `README.md` is tracked by git. The `.gitignore` keeps
`server/data/cache/` (the scraper's own cache) out of the repo.
