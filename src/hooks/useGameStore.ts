import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { useUserStore } from './useUserStore';

export interface Game {
  id: string;
  thumbnailUrl: string;
  gameUrl: string;
  categoryId: 'action' | 'puzzle' | 'casual';
  sortOrder?: 'asc' | 'desc'; // 'desc' is default (higher is better)
  orientation?: 'portrait' | 'landscape'; // 'portrait' is default if not specified
  width?: number;
  height?: number;
}

export interface ScoreEntry {
  userId: string;
  score: number;
  date: number;
}

export interface UserProfile {
  nickname: string;
  avatarColor: string;
  joinedAt: number;
}

interface GameState {
  games: Game[];
  currentGame: Game | null;
  leaderboard: Record<string, ScoreEntry[]>;
  personalBests: Record<string, number>;
  userRanks: Record<string, number>;
  userProfile: UserProfile;
  playCounts: Record<string, number>;
  dailyStats: Record<string, { date: string, playCount: number }[]>;
  setCurrentGame: (game: Game | null) => void;
  addScore: (gameId: string, score: number) => Promise<void>;
  getBestScore: (gameId: string) => number;
  setNickname: (nickname: string) => void;
  fetchLeaderboard: (gameId: string) => Promise<void>;
  fetchUserRank: (gameId: string) => Promise<void>;
  fetchUserRecords: () => Promise<void>;
  incrementPlayCount: (gameId: string) => Promise<void>;
  fetchPlayCounts: () => Promise<void>;
  fetchDailyStats: (gameId: string) => Promise<void>;
}

const getRandomColor = () => {
  const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e'];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      games: [
        {
          id: '2048',
          thumbnailUrl: 'games/2048/thumb.svg',
          gameUrl: 'games/2048/index.html',
          categoryId: 'puzzle',
          orientation: 'portrait'
        },
        {
          id: 'stack-tower',
          thumbnailUrl: 'games/stack/thumb.svg',
          gameUrl: 'games/stack/index.html',
          categoryId: 'casual',
          orientation: 'portrait'
        },
        {
          id: 'zigzag',
          thumbnailUrl: 'games/zigzag/thumb.svg',
          gameUrl: 'games/zigzag/index.html',
          categoryId: 'casual',
          orientation: 'portrait'
        },
        {
          id: 'jump',
          thumbnailUrl: 'games/jump/thumb.png',
          gameUrl: 'games/jump/index.html',
          categoryId: 'casual',
          orientation: 'portrait'
        },
        {
          id: 'neon-breakout',
          thumbnailUrl: 'games/breakout/thumb.svg',
          gameUrl: 'games/breakout/index.html',
          categoryId: 'action',
          orientation: 'portrait'
        },
        {
          id: 'helix',
          thumbnailUrl: 'games/helix/thumb.png',
          gameUrl: 'games/helix/index.html',
          categoryId: 'casual',
          orientation: 'portrait'
        },
        {
          id: 'speedrush',
          thumbnailUrl: 'games/speedrush/thumb.png',
          gameUrl: 'games/speedrush/index.html',
          categoryId: 'action',
          orientation: 'portrait'
        },
        {
          id: 'domino',
          thumbnailUrl: 'games/domino/thumb.svg',
          gameUrl: 'games/domino/index.html',
          categoryId: 'puzzle',
          orientation: 'portrait'
        },
        {
          id: 'minesweeper',
          thumbnailUrl: 'games/minesweeper/thumb.png',
          gameUrl: 'games/minesweeper/index.html',
          categoryId: 'puzzle',
          sortOrder: 'asc',
          orientation: 'portrait'
        },
        {
          id: 'bulletdodge',
          thumbnailUrl: 'games/bulletdodge/thumb.png',
          gameUrl: 'games/bulletdodge/index.html',
          categoryId: 'action',
          orientation: 'portrait'
        },
        {
          id: 'swarm',
          thumbnailUrl: 'games/swarm/thumb.png',
          gameUrl: 'games/swarm/index.html',
          categoryId: 'action',
          orientation: 'portrait'
        },
        {
          id: 'solitaire',
          thumbnailUrl: 'games/solitaire/thumb.png',
          gameUrl: 'games/solitaire/index.html',
          categoryId: 'puzzle',
          sortOrder: 'asc', // Lower time is better
          orientation: 'portrait'
        },

      ],

      currentGame: null,
      leaderboard: {},
      personalBests: {},
      userRanks: {},
      userProfile: {
        nickname: `Guest_${Math.floor(Math.random() * 9000) + 1000}`,
        avatarColor: getRandomColor(),
        joinedAt: Date.now(),
      },
      playCounts: {},
      dailyStats: {},
      setCurrentGame: (game) => set({ currentGame: game }),

      incrementPlayCount: async (gameId) => {
        try {
          // 1. Call Supabase RPC to increment safely (Now handles both total and daily)
          const { error } = await supabase.rpc('increment_play_count', { target_game_id: gameId });
          
          if (error) {
            // Fallback to manual update if RPC fails
            console.warn('[useGameStore] RPC failed, trying manual update:', error.message);
            const today = new Date().toISOString().split('T')[0];
            
            // Increment total
            await supabase
              .from('game_stats')
              .upsert({ game_id: gameId, play_count: (get().playCounts[gameId] || 0) + 1 }, { onConflict: 'game_id' });
            
            // Increment daily
            const { data: dailyData } = await supabase
              .from('game_daily_stats')
              .select('play_count')
              .eq('game_id', gameId)
              .eq('date', today)
              .single();
            
            await supabase
              .from('game_daily_stats')
              .upsert({ 
                game_id: gameId, 
                date: today, 
                play_count: (dailyData?.play_count || 0) + 1 
              }, { onConflict: 'game_id,date' });
          }

          // 2. Update local state
          const today = new Date().toISOString().split('T')[0];
          set((state) => {
            const updatedPlayCounts = {
              ...state.playCounts,
              [gameId]: (state.playCounts[gameId] || 0) + 1
            };

            // Also update dailyStats if it exists in local state
            const updatedDailyStats = { ...state.dailyStats };
            if (updatedDailyStats[gameId]) {
                const todayEntryIndex = updatedDailyStats[gameId].findIndex(d => d.date === today);
                if (todayEntryIndex !== -1) {
                    updatedDailyStats[gameId][todayEntryIndex].playCount += 1;
                } else {
                    updatedDailyStats[gameId].push({ date: today, playCount: 1 });
                }
            }

            return { 
                playCounts: updatedPlayCounts,
                dailyStats: updatedDailyStats
            };
          });
        } catch (err) {
          console.error('[useGameStore] Error incrementing play count:', err);
        }
      },

      fetchPlayCounts: async () => {
        try {
          const { data, error } = await supabase
            .from('game_stats')
            .select('game_id, play_count');

          if (error) throw error;

          if (data) {
            const counts: Record<string, number> = {};
            data.forEach((item: any) => {
              counts[item.game_id] = parseInt(item.play_count);
            });
            set({ playCounts: counts });
          }
        } catch (err) {
          console.error('[useGameStore] Error fetching play counts:', err);
        }
      },

      fetchDailyStats: async (gameId) => {
        try {
          const { data, error } = await supabase
            .from('game_daily_stats')
            .select('date, play_count')
            .eq('game_id', gameId)
            .order('date', { ascending: true })
            .limit(30);

          if (error) throw error;

          if (data) {
            const formatted = data.map((d: any) => ({
              date: d.date,
              playCount: parseInt(d.play_count)
            }));
            
            set((state) => ({
              dailyStats: {
                ...state.dailyStats,
                [gameId]: formatted
              }
            }));
          }
        } catch (err) {
          console.error('[useGameStore] Error fetching daily stats:', err);
        }
      },

      addScore: async (gameId, score) => {
        const { user, userName } = useUserStore.getState();
        const currentBest = get().personalBests[gameId];
        const game = get().games.find(g => g.id === gameId);
        const sortOrder = game?.sortOrder || 'desc';

        // 1. Check if this is a new personal best
        if (sortOrder === 'asc' && score <= 0) return; // Only register positive times for ASC games

        let isNewRecord = false;
        if (currentBest === undefined || currentBest === 0) {
          isNewRecord = true;
        } else {
          if (sortOrder === 'asc') {
            // Lower is better (e.g. 10s is better than 20s)
            if (score < currentBest) isNewRecord = true;
          } else {
            // Higher is better (default)
            if (score > currentBest) isNewRecord = true;
          }
        }

        if (!isNewRecord) return;



        // 2. Update local state immediately (for all users, including guests)
        set((state) => ({
          personalBests: {
            ...state.personalBests,
            [gameId]: score
          }
        }));

        // 3. Update local leaderboard for visual feedback
        const currentBoard = get().leaderboard[gameId] || [];
        const filteredBoard = currentBoard.filter(entry => entry.userId !== userName);

        const newEntry: ScoreEntry = {
          userId: userName,
          score,
          date: Date.now()
        };

        const updatedBoard = [...filteredBoard, newEntry]
          .sort((a, b) => sortOrder === 'asc' ? a.score - b.score : b.score - a.score)
          .slice(0, 5);

        set((state) => ({
          leaderboard: {
            ...state.leaderboard,
            [gameId]: updatedBoard,
          },
        }));

        // 4. Submit to Supabase ONLY if authenticated
        if (!user) return;

        try {
          const { error } = await supabase
            .from('scores')
            .upsert(
              { game_id: gameId, user_name: userName, score: score },
              { onConflict: 'game_id,user_name' }
            );

          if (error) {
            console.error('[useGameStore] Supabase upsert error:', error.message);
          }
        } catch (e) {
          console.error('[useGameStore] Supabase exception:', e);
        }
      },

      fetchLeaderboard: async (gameId) => {
        const game = get().games.find(g => g.id === gameId);
        const sortOrder = game?.sortOrder || 'desc';

        try {
          const { data, error } = await supabase
            .from('scores')
            .select('*')
            .eq('game_id', gameId)
            .order('score', { ascending: sortOrder === 'asc' })
            .limit(30);

          if (error) {
            console.error('Error fetching leaderboard from Supabase:', error);
            return;
          }

          if (data) {
            const formattedBoard: ScoreEntry[] = data.map((item: any) => ({
              userId: item.user_name,
              score: item.score,
              date: new Date(item.created_at).getTime()
            }));

            set((state) => ({
              leaderboard: {
                ...state.leaderboard,
                [gameId]: formattedBoard,
              }
            }));
          }
        } catch (e) {
          console.error('Supabase fetch exception:', e);
        }
      },
      fetchUserRank: async (gameId) => {
        const score = get().personalBests[gameId];
        const game = get().games.find(g => g.id === gameId);
        const sortOrder = game?.sortOrder || 'desc';

        if (score === undefined || score === 0) {
          set((state) => ({
            userRanks: { ...state.userRanks, [gameId]: 0 }
          }));
          return;
        }

        try {
          // Count users with better scores
          const query = supabase
            .from('scores')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', gameId);

          if (sortOrder === 'asc') {
            query.lt('score', score);
          } else {
            query.gt('score', score);
          }

          const { count, error } = await query;

          if (error) {
            console.error('Error fetching user rank:', error);
            return;
          }

          set((state) => ({
            userRanks: {
              ...state.userRanks,
              [gameId]: (count || 0) + 1
            }
          }));
        } catch (e) {
          console.error('Supabase rank fetch exception:', e);
        }
      },
      fetchUserRecords: async () => {
        const { user, userName } = useUserStore.getState();
        if (!user) return;

        try {
          const { data, error } = await supabase
            .from('scores')
            .select('game_id, score')
            .eq('user_name', userName);

          if (error) {
            console.error('Error fetching user records from Supabase:', error);
            return;
          }

          if (data) {
            const records: Record<string, number> = {};
            data.forEach((item: any) => {
              records[item.game_id] = item.score;
            });

            set({ personalBests: records });
          }
        } catch (e) {
          console.error('Supabase fetch records exception:', e);
        }
      },
      getBestScore: (gameId) => {
        const board = get().leaderboard[gameId] || [];
        return board.length > 0 ? board[0].score : 0;
      },
      setNickname: (nickname) => set((state) => ({
        userProfile: {
          ...state.userProfile,
          nickname,
        }
      })),
    }),
    {
      name: 'hyper-game-storage',
      partialize: (state) => ({
        leaderboard: state.leaderboard,
        personalBests: state.personalBests,
        userProfile: state.userProfile,
        playCounts: state.playCounts
      }),
    }
  )
);