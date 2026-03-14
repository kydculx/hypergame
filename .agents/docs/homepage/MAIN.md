# Homepage & Platform Architecture
**Location:** `/src/`

## 1. Core Pages
- **Home (`/`)**: `src/pages/Home.tsx` - Game grid, hero section, and navigation.
- **Community (`/community`)**: `src/pages/Community.tsx` - Board for users to share posts.
- **Leaderboard (`/leaderboard`)**: `src/pages/Leaderboard.tsx` - Global rankings.
- **Chat (`/chat`)**: `src/pages/ChatPage.tsx` - Full-page real-time chat.
- **Admin Dashboard (`/admin-stats`)**: `src/pages/AdminDashboard.tsx` - Secure statistics and trends.

## 2. Key UI Components
- **Header**: `src/components/layout/Header.tsx` - Logo, Navigation, Language Toggle (KO/EN), Admin stats button.
- **Portal Background**: `src/components/layout/PortalBackground.tsx` - Visual flair for the whole app.
- **Charts**: `src/components/stats/GameStatsChart.tsx` - SVG-based performance visualization.

## 3. State Management (Zustand)
- **UserStore**: `src/hooks/useUserStore.ts` - Auth, Profile, Admin status.
- **ChatStore**: `src/hooks/useChatStore.ts` - Supabase Realtime channel subscription.
- **Presence**: `src/hooks/usePresence.ts` - Real-time online user count.
