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
  userProfile: UserProfile;
  setCurrentGame: (game: Game | null) => void;
  addScore: (gameId: string, score: number) => Promise<void>;
  getBestScore: (gameId: string) => number;
  setNickname: (nickname: string) => void;
  fetchLeaderboard: (gameId: string) => Promise<void>;
  fetchUserRecords: () => Promise<void>;
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
        },
        {
          id: 'stack-tower',
          thumbnailUrl: 'games/stack/thumb.svg',
          gameUrl: 'games/stack/index.html',
          categoryId: 'casual',
        },
        {
          id: 'zigzag',
          thumbnailUrl: 'games/zigzag/thumb.svg',
          gameUrl: 'games/zigzag/index.html',
          categoryId: 'casual',
        },
        {
          id: 'jump',
          thumbnailUrl: 'games/jump/thumb.png',
          gameUrl: 'games/jump/index.html',
          categoryId: 'casual',
        },
        {
          id: 'neon-breakout',
          thumbnailUrl: 'games/breakout/thumb.svg',
          gameUrl: 'games/breakout/index.html',
          categoryId: 'action',
        },
        {
          id: 'helix',
          thumbnailUrl: 'games/helix/thumb.png',
          gameUrl: 'games/helix/index.html',
          categoryId: 'casual',
        },
        {
          id: 'speedrush',
          thumbnailUrl: 'games/speedrush/thumb.png',
          gameUrl: 'games/speedrush/index.html',
          categoryId: 'action',
        },
        {
          id: 'domino',
          thumbnailUrl: 'games/domino/thumb.svg',
          gameUrl: 'games/domino/index.html',
          categoryId: 'puzzle',
        },
        {
          id: 'minesweeper',
          thumbnailUrl: 'games/minesweeper/thumb.png',
          gameUrl: 'games/minesweeper/index.html',
          categoryId: 'puzzle',
          sortOrder: 'asc'
        },
        {
          id: 'bulletdodge',
          thumbnailUrl: 'games/bulletdodge/thumb.png',
          gameUrl: 'games/bulletdodge/index.html',
          categoryId: 'action',
        },
        {
          id: 'swarm',
          thumbnailUrl: 'games/swarm/thumb.png',
          gameUrl: 'games/swarm/index.html',
          categoryId: 'action',
        },

      ],

      currentGame: null,
      leaderboard: {},
      personalBests: {},
      userProfile: {
        nickname: `Guest_${Math.floor(Math.random() * 9000) + 1000}`,
        avatarColor: getRandomColor(),
        joinedAt: Date.now(),
      },
      setCurrentGame: (game) => set({ currentGame: game }),

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
        userProfile: state.userProfile
      }),
    }
  )
);