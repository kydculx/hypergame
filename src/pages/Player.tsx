import React, { useEffect, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Maximize, RotateCcw } from 'lucide-react';

const Player: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const currentGame = useGameStore((state) => state.currentGame);
  const games = useGameStore((state) => state.games);
  const setCurrentGame = useGameStore((state) => state.setCurrentGame);
  const addScore = useGameStore((state) => state.addScore);
  const bestScore = useGameStore((state) => state.getBestScore(gameId || ''));
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
    <div className="flex flex-col h-screen w-full bg-black overflow-hidden" style={{ overscrollBehavior: 'none', touchAction: 'none' }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-xl font-bold">{currentGame.title}</h2>
            <div className="flex items-center gap-4">
              <p className="text-xs text-gray-400">Score: <span className="text-indigo-400 font-mono text-sm">{score}</span></p>
              <p className="text-xs text-gray-400">Best: <span className="text-amber-400 font-mono text-sm">{bestScore}</span></p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400" title="Restart">
            <RotateCcw size={20} />
          </button>
          <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400" title="Fullscreen">
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {/* Game Container */}
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
