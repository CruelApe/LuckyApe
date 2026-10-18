# 🐒 Lucky Ape — Smart Probability, Bananas Results.

> **Lucky Ape** is a modern, data-driven mobile application designed to analyze historical draw data from *The Lott Australia* and generate optimized lottery combinations using statistical probability models.

---

## 💡 About The Project

Let’s be honest: lottery balls don’t have a memory, and no algorithm can predict the future (if we could, we’d be committing code from a yacht in the Whitsundays). But why pick random birthdays or draw smiley faces on your entry slip when you can let cold, hard data do the heavy lifting?

**Lucky Ape** takes the mindless guessing out of the game and replaces it with sheer statistical swagger. Built with a sleek, high-performance React Native stack, the app scrapes real-time draw history directly from *The Lott Australia* to deliver data-backed combinations in a single tap.

---

## ✨ Core Features

- **🎮 Full Game Support**: Live results and generation models for:
  - TattsLotto (`/tattslotto`)
  - Weekday Windfall (`/weekday-windfall`)
  - Oz Lotto (`/oz-lotto`)
  - Powerball (`/powerball`)
  - Lucky Lotteries Super & Mega Jackpot (`/lucky-lotteries`)
  - Super 66 (`/super-66`)
- **🧠 4 Statistical Generation Engines**:
  - **Hot Numbers Mode**: Weighted frequency distribution prioritizing high-performing numbers.
  - **Cold / Overdue Mode**: Inverse weighting targeting numbers due for a bounce.
  - **Balanced Model**: Enforces standard sum ranges and optimal odd-even ratios (e.g., 3:3 / 4:2 splits).
  - **Supplementary Bounce**: Models past supplementary/Powerball numbers transitioning into main winning sets.
- **⚡ System Entry Power**: Generate System 7–20 combinations and PowerHit selections matched to official game mechanics.
- **📖 In-App "How to Play" Guides**: Dynamic rulebook breakdowns, winning division odds, and play mechanics parsed directly from the source.
- **🎨 Sleek Modern UI**:
  - Fast splash screen with real-time preloading progress tracking.
  - Interactive, game-branded ball visualizers.
  - Seamless **Light ☀️ / Dark 🌙 Mode** theme switcher.

---

## 🛠️ Tech Stack & Architecture

- **Mobile Framework**: React Native with [Expo SDK 53/54+](https://expo.dev) & Expo Router
- **Styling & UI**: Tailwind CSS via NativeWind & Lucide React Native Icons
- **State & Caching**: Zustand (Local state & Theme) & TanStack Query (API fetching/caching)
- **Data Persistence**: React Native Async Storage
- **Backend / Web Scraper**: Node.js / Python microservice targeting `thelott.com`

---

## ⚙️ Quick Start & Local Setup

### Prerequisites
- Node.js (v18+) or Bun
- Expo Go app on iOS/Android or local Xcode/Android Studio simulators

### Installation

1. **Clone the repository**:
   ```bash
   git clone [https://github.com/your-username/lucky-ape.git](https://github.com/your-username/lucky-ape.git)
   cd lucky-ape
