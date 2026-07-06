# 2048 Bot

An **Expectimax AI bot** embedded inside the Chrome **2048 Multiplayer** extension. It reads the game board from the DOM, simulates moves locally, and plays automatically through the game's internal engine (no synthetic keyboard events).

![Extension ID](https://img.shields.io/badge/extension-ijkmjnaahlnmdjjlbhbjbhlnmadmmlgg-blue)

---

## Features

- **Auto-inject control panel** when you open a game (Classic, Multiplayer, Battle Royale, Speedrun)
- **Expectimax search** with proven heuristics (monotonicity, smoothness, merge potential, corner strategy)
- **Adjustable Speed** — delay between moves (`Instant` to `2.0s`, 1 ms steps)
- **Adjustable Expert** — search depth and think time (Level 1–10)
- **Live stats** — moves, score, last direction, AI score, search depth
- **Panel in brown margin** — sits outside the white game area so the grid layout is not blocked

---

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder:

   ```
   ijkmjnaahlnmdjjlbhbjbhlnmadmmlgg/1.1.0.53_0
   ```

5. Pin the **2048** extension and open the game (popup or separate window)

> **Tip:** Open the game in a **separate window** (right-click extension icon) and make the window slightly wider/taller so the bot panel has room in the brown margin beside or below the game.

After updating bot files, click **Reload** on the extension at `chrome://extensions`.

---

## How to use

1. Open the 2048 extension
2. Start a game mode:
   - **Classic 2048** — best AI performance
   - **Multiplayer / Battle Royale / Speedrun** — supported with same bot logic
3. When the game board appears, the **2048 Bot** panel shows in the brown area
4. Set **Speed** and **Expert** sliders
5. Click **Start Bot**
6. Click **Stop** to pause

Settings are saved in `localStorage` and persist between sessions.

---

## Controls

### Speed

Time to wait **after each move** before the bot continues.

| Value | Meaning |
|-------|---------|
| **Instant (0)** | As fast as the game allows (one animation frame between moves) |
| **50–150 ms** | Recommended for high scores |
| **500 ms+** | Easier to watch |

### Expert

How hard the AI thinks **before each move**.

| Level | Max depth | Think budget | Use case |
|-------|-----------|--------------|----------|
| 1–3 | 3–4 | ~40–120 ms | Fast, light play |
| 4–6 | 5–6 | ~160–240 ms | Balanced |
| 7–8 | 7 | ~280–320 ms | Strong |
| 9–10 | 8 | ~360–400 ms | Maximum strength |

The label shows: `L7 · d7 · 280ms` (level, depth, think time).

### Stats

| Stat | Description |
|------|-------------|
| **Moves** | Bot move count this session |
| **Score** | Current game score |
| **Last** | Last direction played (left / up / right / down) |
| **AI** | Heuristic score of the chosen move |
| **Depth** | Search depth reached (e.g. `d7`) |

---

## How the AI works

This is **not** ChatGPT or a neural network. Everything runs locally in JavaScript.

### Algorithm

**Expectimax** — standard approach for 2048:

1. Try each possible move (left, up, right, down)
2. Simulate random tile spawns (90% `2`, 10% `4`)
3. Search several plies ahead (iterative deepening)
4. Score each board with heuristics
5. Pick the move with the best expected score

### Heuristics

Based on common open-source 2048 solvers:

- **Empty cells** — more open space is safer
- **Monotonicity** — tiles sorted in rows/columns (snake pattern)
- **Smoothness** — neighbors have similar values (easier merges)
- **Merge potential** — adjacent equal tiles ready to combine
- **Corner / grid weights** — keep the largest tile in the bottom-right

### Move execution

The bot calls the game's internal `move()` API via `window.__2048GameManager` instead of sending keyboard events (the game rejects non-trusted key events).

---

## Supported game modes

| Mode | Screen class | Notes |
|------|--------------|-------|
| Classic 2048 | `.screen.single` | Best results |
| Multiplayer duel | `.screen.ingame` | Plays your board only |
| Battle Royale | `.screen.battleroyale` | Real-time; no opponent modeling |
| Speedrun | `.screen.solo` | Works; optimized for Classic |

---

## Project structure

```
2048 Bot/
├── README.md
└── ijkmjnaahlnmdjjlbhbjbhlnmadmmlgg/
    └── 1.1.0.53_0/              ← Load this folder in Chrome
        ├── popup.html           ← Loads bot scripts
        ├── bot/
        │   ├── bot.js           ← UI panel, game loop, DOM reader
        │   ├── bot.css          ← Panel styling
        │   ├── ai.js            ← Expectimax + heuristics
        │   └── board.js         ← Board simulation + direction mapping
        ├── single_files/
        │   └── popup.js         ← Patched: exposes Classic game manager
        └── files/js/
            └── popup.js         ← Patched: exposes multiplayer game manager
```

---

## Patches to the extension

These minimal hooks connect the bot to the game engine:

| File | Change |
|------|--------|
| `popup.html` | Loads `bot/bot.css`, `bot/board.js`, `bot/ai.js`, `bot/bot.js` |
| `single_files/popup.js` | Sets `window.__2048GameManager` when Classic starts |
| `files/js/popup.js` | Sets `window.__2048GameManager` when multiplayer match starts |

---

## Troubleshooting

### Page unresponsive / slow when opening Classic

Reload the extension. The bot only watches the `.screen` element for mode changes (not every tile animation).

### Bot panel inside the white game area

Resize the window or open in a separate window so the brown margin is visible. The panel auto-positions in available margin space.

### Bot does nothing after Start

- Wait until tiles are visible on the board
- Classic mode must be fully loaded
- Check the hint text under the buttons for status (`Waiting for game engine...`, etc.)

### "No SW" errors in extension console

These come from `files/js/window.js` (service worker messaging) and are unrelated to the bot.

### Weak play at Instant speed

Use **Speed 50–100 ms** and **Expert 8–10**. Instant mode can read the board before animations finish on some machines.

---

## Console API

With DevTools open on the game page:

```javascript
window.__2048Bot.start();      // Start bot
window.__2048Bot.stop();       // Stop bot
window.__2048Bot.readBoard();  // Read current grid as 16-element array
window.__2048Bot.injectPanel(); // Force panel injection
```

---

## Disclaimer

This bot is for **personal / educational use**. Using automated play in **rated multiplayer** may violate the game's terms of service.

---

## License

Bot code (`bot/` folder and patches listed above) is provided as-is. The underlying 2048 extension remains the property of its original authors.
