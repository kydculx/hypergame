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
          thumbnailUrl: 'images/stack-tower-thumb.svg',
          gameUrl: 'games/stack/index.html',
          category: 'action',
        },
        {
          id: 'zigzag',
          title: 'ZigZag',
          description: 'Stay on the wall and do as many zigzags as you can!',
          thumbnailUrl: 'images/zigzag-thumb.svg',
          gameUrl: 'games/zigzag/index.html',
          category: 'action',
        },
        {
          id: 'neon-jump',
          title: 'Neon Jump',
          description: 'Navigate the neon pipes.',
          thumbnailUrl: 'images/neon-jump-thumb.svg',
          gameUrl: 'games/neon/index.html',
          category: 'action',
        },
        {
          id: 'neon-breakout',
          title: 'Neon Breakout',
          description: 'Classic brick-breaking action with high-octane neon visuals and particles!',
          thumbnailUrl: 'images/neon-breakout-thumb.svg',
          gameUrl: 'games/breakout/index.html',
          category: 'action',
        },
        {
          id: 'helix',
          title: 'Helix Jump',
          description: 'Rotate the tower and guide the bouncing ball to the bottom!',
          thumbnailUrl: 'images/helix-thumb.svg',
          gameUrl: 'games/helix/index.html',
          category: 'action',
        },
        {
          id: 'geometry',
          title: 'Geometry Dash',
          description: 'Jump and fly through danger in this rhythm-based action platformer!',
          thumbnailUrl: 'images/geometry-thumb.svg',
          gameUrl: 'games/geometry/index.html',
          category: 'action',
        },
        {
          id: 'domino',
          title: 'Domino Match',
          description: 'Bridge the gaps with the right size domino to keep the chain reacting!',
          thumbnailUrl: 'images/domino-thumb.svg',
          gameUrl: 'games/domino/index.html',
          category: 'puzzle',
        },

      ],

      currentGame: null,
      leaderboard: {},
      userProfile: {
        nickname: `Guest_${Math.floor(Math.random() * 9000) + 1000}`,
        avatarColor: getRandomColor(),
        joinedAt: Date.now(),
      },
      setCurrentGame: (game) => set({ currentGame: game }),

      addScore: async (gameId, score) => {
        // Only allow score submission if the user is authenticated
        const { user, userName } = useUserStore.getState();
        if (!user) {
          console.warn('Guest users cannot submit scores to the leaderboard.');
          return; // Early return to prevent saving
        }

        // 1. Submit to Supabase
        try {
          const { error } = await supabase
            .from('scores')
            .insert([
              { game_id: gameId, user_name: userName, score: score }
            ]);

          if (error) {
            console.error('Error inserting score to Supabase:', error);
          }
        } catch (e) {
          console.error('Supabase exception:', e);
        }

        // 2. Also update local state for immediate feedback
        const currentBoard = get().leaderboard[gameId] || [];
        const newEntry: ScoreEntry = {
          userId: userName,
          score,
          date: Date.now()
        };

        const updatedBoard = [...currentBoard, newEntry]
          .sort((a, b) => b.score - a.score)
          .slice(0, 5); // Keep top 5 locally

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
            .limit(5);

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
        userProfile: state.userProfile
      }),
    }
  )
);