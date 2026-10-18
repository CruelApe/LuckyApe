# 🐒 Lucky Ape — Smart Probability, Bananas Results.

> **Lucky Ape** is a modern, data-driven mobile application designed to analyze historical draw data from *The Lott Australia* and generate optimized lottery combinations using statistical probability models.

---

## 💡 About The Project

Let’s be honest: lottery balls don’t have a memory, and no algorithm can predict the future (if we could, we’d be committing code from a yacht in the Whitsundays). But why pick random birthdays or draw smiley faces on your entry slip when you can let cold, hard data do the heavy lifting?

**Lucky Ape** takes the mindless guessing out of the game and replaces it with sheer statistical swagger. Built with a sleek, high-performance React Native stack, the app reads real draw history from *The Lott Australia* to deliver data-backed combinations in a single tap.

> ⚠️ **What it is — and isn't.** Every draw is random and independent. Lucky Ape's numbers are *descriptive* (what the past looks like), not *predictive*. It changes *how* you choose numbers, not your odds of winning. The app says so, and so does this README.

---

## ✨ Core Features

- **🎮 Full Game Support**: results, rules and jackpots for
  - TattsLotto (`/tattslotto`)
  - Weekday Windfall (`/weekday-windfall`)
  - Oz Lotto (`/oz-lotto`)
  - Powerball (`/powerball`)
  - Lucky Lotteries Super Jackpot (`/lucky-lotteries-super`) & Mega Jackpot (`/lucky-lotteries-mega`)
  - Super 66 (`/super-66`)
- **🧠 Statistical Generation Engines** (TattsLotto, Weekday Windfall, Oz Lotto, Powerball):
  - **Hot Numbers Mode**: Weighted frequency distribution prioritizing recently high-performing numbers.
  - **Cold / Overdue Mode**: Inverse weighting targeting numbers that have been absent the longest.
  - **Balanced Model**: Enforces a typical odd-even split (e.g., 3:3 / 4:2), a historical sum range and no long runs.
  - **Supplementary Bounce**: Carries recent supplementary / Powerball numbers into the main set — and measures, honestly, how often those numbers really do reappear next to what chance alone would predict (so far: no meaningful difference).
- **⚡ System Entry Power**: Generate System entries across each game's official range (**7–20** for TattsLotto and Weekday Windfall, **8–20** for Oz Lotto and Powerball), including **PowerHit System** (8–15) for Powerball, with the exact number of games each entry covers.
- **🎟️ Games with nothing to choose**: Lucky Lotteries (raffle) and Super 66 (QuickPick-only) allocate your numbers, so no model can help. Lucky Ape shows their results, rules and jackpots, and says so plainly instead of pretending.
- **📖 In-App "How to Play" Guides**: Pick/pool, system ranges, prize divisions and odds — read from the official pages and checked against the generator's own rules.
- **🔖 Saved Ticket Library**: Keep combinations on-device, share them, delete them.
- **🎨 Sleek Modern UI**:
  - Fast splash screen with real-time preloading progress (it reflects actual work: fetching each game, then computing its probability distributions).
  - Interactive, game-branded ball visualizers with statistical rationale badges ("3 hot", "2 odd · 4 even", "Sum 138"…).
  - Seamless **Light ☀️ / Dark 🌙 Mode** switcher (or follow the device).
  - Always tells you whether you're looking at **live**, **saved offline** or **sample** data.

---

## 🛠️ Tech Stack & Architecture

- **Mobile Framework**: React Native with [Expo SDK 58](https://expo.dev) & Expo Router (file-based routing, typed routes)
- **Styling & UI**: Tailwind CSS via NativeWind v4 & Lucide React Native Icons
- **State & Caching**: Zustand (theme, saved tickets) & TanStack Query (API fetching/caching)
- **Data Persistence**: React Native Async Storage (saved tickets, offline snapshots)
- **Backend / Web Scraper**: Node.js + Fastify service (`/server`) reading `thelott.com`
- **Language**: TypeScript throughout; the statistical engine is pure, seedable and unit-tested

```
LuckyApe/
├─ src/
│  ├─ app/          Expo Router routes (thin wrappers around screens)
│  ├─ screens/      SplashScreen, GameSelectorScreen, GeneratorScreen, AboutScreen, RulesScreen, SavedTicketsScreen
│  ├─ components/   NumberBall, GameCard, TicketCard, AnalysisPanel, ThemeToggle, …
│  ├─ lib/          Statistical engine: analysis, hot/cold/balanced/bounce, System entries (pure TS)
│  ├─ services/     API client, offline cache, loadGame(), preload progress model
│  ├─ store/        Zustand stores (theme, saved tickets)
│  └─ constants/    Theme tokens, per-game ball colours, mode descriptions
├─ shared/          Types, built-in game rules and sample data — used by the app *and* the server
├─ server/          The scraper service (see below)
└─ assets/          Logo (SVG source) and generated app icons
```

### How the data gets into the app

```
 thelott.com ──► server (Fastify) ──► GET /api/games/:slug ──► app ──► TanStack Query
   │  data API (results, jackpots, draw days)       │                      │
   │  how-to-play pages (rules, odds, systems)      ▼                      ▼
   └─ source order: import → thelott → sample   cache on disk        AsyncStorage copy
                                                                      (used when offline)
```

- **Results, jackpots and draw days** come from The Lott's public data API — the same `sales/vmax/web/data/lotto/…` endpoints the official site's own front end calls. History is collected in the small windows the API allows (≤ 50 draw numbers per request), then cached for 6 hours.
- **Rules, system ranges and prize odds** are parsed from the server-rendered *How to play* pages, validated (e.g. Division 1 odds must equal C(pool, pick)), and merged over the built-in rules. If the site changes and a value no longer validates, the built-in value stays — a layout change can degrade the data but never corrupt the generator.
- The scraper is deliberately polite: it identifies itself, spaces requests out, runs them one at a time, and backs off for 15 minutes if the site answers 401/403/429.
- **Fallbacks, in order of preference**: your own imported history (`server/data/imports`), live data, the last good copy on the phone, and finally **clearly labelled sample data** (generated, never presented as real results, and never shown in place of real data you already have).

---

## ⚙️ Quick Start & Local Setup

### Prerequisites
- **Node.js 20.12 or newer** (22/24 LTS recommended) — the server uses `process.loadEnvFile`
- The **Expo Go** app on iOS/Android *(or Xcode / Android Studio simulators)*
- Phone and computer on the same Wi-Fi if you use a physical device

### Installation

```powershell
git clone https://github.com/CruelApe/LuckyApe.git
cd LuckyApe
npm install
npm run server:install
```

### Run it

Open two terminals in the repo:

```powershell
# Terminal 1 — the scraper service (http://localhost:8787)
npm run server:dev

# Terminal 2 — the app
npm start        # then press a / i / w, or scan the QR code with Expo Go
```

The app finds the server by itself in development: it uses the address of the machine running Metro, which works for Expo Go on a phone, the iOS simulator and the Android emulator. The first cold request takes a few seconds per game while the server collects history; after that it is cached.

> **Windows Firewall:** if a physical phone cannot reach the server, allow Node.js on *private networks* when Windows asks, or open port 8787.

**No server? No problem.** Without one the app falls back to the copy cached on the device, and then to labelled sample data, so every screen still works.

### Configuration

| What | Where | Notes |
| --- | --- | --- |
| Server URL for release builds | `EXPO_PUBLIC_API_URL` | e.g. `https://api.example.com`. Unset in a release build ⇒ offline/sample only. |
| Server settings | `server/.env` (copy `server/.env.example`) | Port, cache TTL, history depth, source order, request pacing. |
| Your own results | `server/data/imports/<game>.csv\|json` | See [`server/data/imports/README.md`](server/data/imports/README.md). Takes priority over live data. |

No API keys or secrets are needed. `.env` files are git-ignored.

### Scraper API

| Endpoint | Returns |
| --- | --- |
| `GET /api/games` | Every game's snapshot |
| `GET /api/games/:slug` | One game: rules, draws (newest first), jackpot, `source` (`thelott` \| `import` \| `sample`) |
| `GET /api/status` | Per-game provenance, freshness and last error |
| `GET /api/health` | Liveness |

### Scripts

| Command | Does |
| --- | --- |
| `npm start` / `npm run android` / `npm run ios` / `npm run web` | Run the app |
| `npm run server:dev` / `npm run server:start` | Run the scraper (watch / plain) |
| `npm test` · `npm run server:test` | Unit tests (app + shared · server) |
| `npm run typecheck` | Type-check the app |
| `npm run verify` | Type-check and test *everything* (app + server) |
| `npm run server:check-live` | **Canary**: runs the real pipeline against thelott.com and exits non-zero if the site no longer matches the scraper's expectations. Handy if results ever stop loading. |

---

## 🧪 A note on the statistics

| Mode | What it actually does |
| --- | --- |
| **Hot** | Weights each number by an exponentially decayed count of recent appearances (half-life 40 draws), smoothed so nothing has zero chance. |
| **Cold** | Weights by how overdue a number is (draws since last seen ÷ expected gap), discounted for numbers that are rare overall. |
| **Balanced** | Samples with a gentle lean towards frequent numbers, keeping only combinations with a typical odd/even split, a sum inside the historical 10th–90th percentile band, runs of at most two consecutive numbers and a sensible spread across the ranges. Loosens the filters (and says so) if it can't find a fit. |
| **Bounce** | Reserves up to two slots for supplementary (or Powerball) numbers from the last three draws, and reports the *measured* carry-over rate next to what chance alone predicts. |
| **System** | Picks N numbers (within the game's official range) using any of the above, and shows the exact number of standard games the entry covers: C(N, pick). |

The "rationale badges" on each ticket describe facts about the chosen numbers, not promises about the future.

---

## ⚖️ Disclaimer

Lucky Ape is an independent statistical tool. It is not affiliated with, endorsed by or connected to The Lott, The Lottery Corporation or Tatts Group. Game names and results belong to their respective owners and are used only to identify the games. Draw data is read from The Lott's public pages and may be incomplete or out of date — always check official results. Ball colours are Lucky Ape's own interpretation, not official artwork.

You must be 18 or over to play. If gambling is a problem for you or someone you know, contact **Gambling Help Online on 1800 858 858** (gamblinghelponline.org.au).

---

## 👤 Credits & License

**Developer:** Tyron James Gono · **Powered by CruelApe Software**

© 2026 CruelApe Software. All Rights Reserved. Source code released under the [MIT License](LICENSE).
