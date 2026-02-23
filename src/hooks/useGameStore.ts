import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { useUserStore } from './useUserStore';

export interface Game {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  gameUrl: string;
  category: 'action' | 'puzzle' | 'casual';
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
          id: 'stack-tower',
          title: 'Stack Tower',
          description: 'Stack blocks as high as you can in this 3D hyper-casual game!',
          thumbnailUrl: 'games/stack/thumb.svg',
          gameUrl: 'games/stack/index.html',
          category: 'action',
        },
        {
          id: 'zigzag',
          title: 'ZigZag',
          description: 'Stay on the wall and do as many zigzags as you can!',
          thumbnailUrl: 'games/zigzag/thumb.svg',
          gameUrl: 'games/zigzag/index.html',
          category: 'action',
        },
        {
          id: 'neon-jump',
          title: 'Neon Jump',
          description: 'Navigate the neon pipes.',
          thumbnailUrl: 'games/neon/thumb.svg',
          gameUrl: 'games/neon/index.html',
          category: 'action',
        },
        {
          id: 'neon-breakout',
          title: 'Neon Breakout',
          description: 'Classic brick-breaking action with high-octane neon visuals and particles!',
          thumbnailUrl: 'games/breakout/thumb.svg',
          gameUrl: 'games/breakout/index.html',
          category: 'action',
        },
        {
          id: 'helix',
          title: 'Helix Jump',
          description: 'Rotate the tower and guide the bouncing ball to the bottom!',
          thumbnailUrl: 'games/helix/thumb.svg',
          gameUrl: 'games/helix/index.html',
          category: 'action',
        },
        {
          id: 'geometry',
          title: 'Geometry Dash',
          description: 'Jump and fly through danger in this rhythm-based action platformer!',
          thumbnailUrl: 'games/geometry/thumb.svg',
          gameUrl: 'games/geometry/index.html',
          category: 'action',
        },
        {
          id: 'domino',
          title: 'Domino Match',
          description: 'Bridge the gaps with the right size domino to keep the chain reacting!',
          thumbnailUrl: 'games/domino/thumb.svg',
          gameUrl: 'games/domino/index.html',
          category: 'puzzle',
        },
        {
          id: 'minesweeper',
          title: 'Mine Sweeper',
          description: 'Classic Minesweeper, neon style! Uncover safe tiles and flag the bombs.',
          thumbnailUrl: 'games/minesweeper/thumb.png',
          gameUrl: 'games/minesweeper/index.html',
          category: 'puzzle',
        },
        {
          id: 'bulletdodge',
          title: 'Bullet Dodge',
          description: 'A relentless neon bullet hell survival game. Dodge thousands of lasers using joystick control and survive!',
          thumbnailUrl: 'games/bulletdodge/thumb.png',
          gameUrl: 'games/bulletdodge/index.html',
          category: 'action',
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
        if (!user) {
          console.warn('Guest users cannot submit scores to the leaderboard.');
          return;
        }

        const currentBest = get().personalBests[gameId] || 0;

        // Check if this is a new personal best
        // Note: For some games (like Mine Sweeper), lower might be better if we use negative values,
        // but here's a generic "higher is better" check. Since Mine Sweeper uses -time, it works.
        if (score <= currentBest && currentBest !== 0) {
          console.log(`Score ${score} is not better than current best ${currentBest}. Not submitting.`);
          return;
        }

        // 1. Submit to Supabase using upsert to maintain one record per user/game
        try {
          // Note: This assumes a unique constraint on (game_id, user_name) in the 'scores' table
          const { error } = await supabase
            .from('scores')
            .upsert(
              { game_id: gameId, user_name: userName, score: score },
              { onConflict: 'game_id,user_name' }
            );

          if (error) {
            console.error('Error upserting score to Supabase:', error);
          }
        } catch (e) {
          console.error('Supabase exception:', e);
        }

        // 2. Update local state
        set((state) => ({
          personalBests: {
            ...state.personalBests,
            [gameId]: score
          }
        }));

        // 3. Update local leaderboard display
        // We filter out the old entry for this user and add the new one
        const currentBoard = get().leaderboard[gameId] || [];
        const filteredBoard = currentBoard.filter(entry => entry.userId !== userName);

        const newEntry: ScoreEntry = {
          userId: userName,
          score,
          date: Date.now()
        };

        const updatedBoard = [...filteredBoard, newEntry]
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        set((state) => ({
          leaderboard: {
            ...state.leaderboard,
            [gameId]: updatedBoard,
          },
        }));
      },

      fetchLeaderboard: async (gameId) => {
        try {
          const { data, error } = await supabase
            .from('scores')
            .select('*')
            .eq('game_id', gameId)
            .order('score', { ascending: false })
            .limit(10);

          if (error) {
            console.error('Error fetching leaderboard from Supabase:', error);
            return;
          }

          if (data) {
            // Map Supabase layout back to our ScoreEntry layout
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