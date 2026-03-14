# Game Integration & Directory
**Location:** `/public/games/`

## 1. Directory Structure
Each game resides in its own folder under `/public/games/[game-id]/`.
- `index.html`: Entry point.
- `game.js`: Core logic.
- `locales/`: Game-specific translations.

## 2. Integration Logic
- **Game Player**: `src/pages/Player.tsx` - The iframe container that hosts the games.
- **Communication**: Games use `window.parent.postMessage` to send scores to the platform via `shared/wcgames-core.js`.
- **Game List**: Managed in `src/hooks/useGameStore.ts`.

## 3. Game-to-Platform Protocol
- `wcgame.score(value)`: Submits a score.
- `wcgame.gameover()`: Triggers game over UI/Ads.
- `wcgame.ready()`: Signals the game is loaded.

## 4. Current Game List
1. **2048** (`games/2048`): Puzzle
2. **Stack Tower** (`games/stack`): Casual
3. **ZigZag** (`games/zigzag`): Casual
4. **Jump** (`games/jump`): Casual
5. **Neon Breakout** (`games/breakout`): Action
6. **Helix** (`games/helix`): Casual
7. **SpeedRush** (`games/speedrush`): Action
8. **Domino** (`games/domino`): Puzzle
9. **Minesweeper** (`games/minesweeper`): Puzzle (Time-based, Ascending)
10. **BulletDodge** (`games/bulletdodge`): Action
11. **Swarm** (`games/swarm`): Action
12. **Solitaire** (`games/solitaire`): Puzzle (Time-based, Ascending)

---
*Last verified: 2026-03-15*
