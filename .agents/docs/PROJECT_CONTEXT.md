# WCGames Project Context & Status
**Last Updated:** 2026-03-15
**Auto-Generated for Context Persistence**

## 1. Project Overview
A premium HTML5 game platform (Hypergame) featuring:
- Instant play games (no downloads).
- Real-time global leaderboards.
- Real-time global chat.
- Community board (Posts & Comments).
- Admin Analytics Dashboard.

## 2. Technical Stack
- **Framework**: React (Vite) + TypeScript.
- **Styling**: Vanilla CSS + Tailwind CSS (Inter/Outfit fonts).
- **Backend**: Supabase (PostgreSQL, Realtime, Auth).
- **State**: Zustand (stores: game, user, chat).
- **Icons**: Lucide React.
- **I18n**: react-i18next (KO/EN).

## 3. Core File Map
- `/src/hooks/useGameStore.ts`: Primary logic for games, scores, and stats.
- `/src/pages/AdminDashboard.tsx`: Secure analytics panel.
- `/src/pages/Player.tsx`: Main game player container (triggers play counts).
- `/src/pages/ChatPage.tsx`: Full-page real-time chat.
- `/src/pages/Community.tsx`: Community forum index.
- `/src/components/stats/GameStatsChart.tsx`: Custom SVG visualization.

## 4. Current Database State (Supabase)
- **Tables**: `game_stats`, `game_daily_stats`, `scores`, `messages`, `posts`, `comments`.
- **RPC**: `increment_play_count` (Handles atomic total + daily increments).

## 5. Recent Significant Milestones
- **Admin Dashboard**: Secure `/admin-stats` with mobile-optimized cards and SVG trend charts.
- **Play Tracking**: Fixed multiple increment bug and added daily date-based tracking.
- **Modularization**: Moved Chat and Leaderboard to dedicated pages.
- **UI Refinement**: Right-aligned community write button with interactive icons.

## 6. Pending / Future Roadmap
- [ ] User activity logs in Profile.
- [ ] Community post categories/tags.
- [ ] New game integrations.

---
**Note to AI Assistant:** When starting a new session, please read this file to regain context.
