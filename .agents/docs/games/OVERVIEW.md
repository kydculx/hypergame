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
- `stack`: Stack blocks as high as possible.
- `domino`: Domino sequence gameplay.
- `speedrush`: Racing game.
- `swarm`: Action/Shooter game.
- `puzzle`: Classic sliding/match puzzle.
