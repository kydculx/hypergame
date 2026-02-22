import React, { useEffect, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';

const Player: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const currentGame = useGameStore((state) => state.currentGame);
  const games = useGameStore((state) => state.games);
  const setCurrentGame = useGameStore((state) => state.setCurrentGame);
  const addScore = useGameStore((state) => state.addScore);
  const navigate = useNavigate();

  const [score, setScore] = useState(0);

  // If page is refreshed, find the game from store
  useEffect(() => {
    if (!currentGame && gameId) {
      const game = games.find(g => g.id === gameId);
      if (game) setCurrentGame(game);
      else navigate('/');
    }
  }, [gameId, currentGame, games, setCurrentGame, navigate]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'SUBMIT_SCORE':
          // We still update the local display score, but don't call addScore here
          if (payload?.score !== undefined) setScore(payload.score);
          break;
        case 'GAME_READY':
          console.log('Game is ready');
          break;
        case 'GAME_OVER':
          const finalScore = payload?.score ?? score;
          if (gameId) addScore(gameId, finalScore);
          setScore(finalScore);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!currentGame) return null;

  return (
    <div
      className="fixed inset-0 w-full bg-black overflow-hidden flex flex-col"
      style={{
        height: '100dvh',
        overscrollBehavior: 'none',
        touchAction: 'none'
      }}
    >
      {/* Absolute UI Layer for Relative Positioning within Safe Area */}
      <div
        className="pointer-events-none absolute inset-0 z-50 flex flex-col justify-start items-end"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 1rem)',
          paddingRight: 'calc(env(safe-area-inset-right) + 1rem)',
        }}
      >
        {/* Close Button - Now positioned relative to Safe Area */}
        <button
          onClick={() => navigate('/')}
          className="pointer-events-auto p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all backdrop-blur-sm"
        >
          <X size={24} />
        </button>
      </div>

      {/* Game Container - Fills the dynamic viewport completely */}
      <div className="flex-1 relative overflow-hidden bg-gray-900">
        <iframe
          src={currentGame.gameUrl}
          className="w-full h-full border-none"
          title={currentGame.title}
          allow="autoplay; fullscreen"
        />
      </div>
    </div>
  );
};

export default Player;
