# Homepage & Platform Architecture
**Location:** `/src/`

## 1. Core Pages
- **Home (`/`)**: `src/pages/Home.tsx` - Main landing page with game grid.
- **Community (`/community`)**: `src/pages/Community.tsx` - User community and forums.
- **Leaderboard (`/leaderboard`)**: `src/pages/LeaderboardPage.tsx` - Global rankings per game.
- **Chat (`/chat`)**: `src/pages/ChatPage.tsx` - Full-screen platform-wide chat.
- **Admin Dashboard (`/admin-stats`)**: `src/pages/AdminDashboard.tsx` - Performance metrics (Admin only).
- **Game Player (`/play/:id`)**: `src/pages/Player.tsx` - Container for playing specific games.

## 2. Key UI Components
- **Header**: `src/components/layout/Header.tsx` - Logo, Navigation, Language Toggle (KO/EN), Admin stats button.
- **Portal Background**: `src/components/layout/PortalBackground.tsx` - Visual flair for the whole app.
- **Charts**: `src/components/stats/GameStatsChart.tsx` - SVG-based performance visualization.

## 3. State Management (Zustand)
- **UserStore**: `src/hooks/useUserStore.ts` - Auth, Profile, Admin status.
- **ChatStore**: `src/hooks/useChatStore.ts` - Supabase Realtime channel subscription.
- **Presence**: `src/hooks/usePresence.ts` - Real-time online user count.
