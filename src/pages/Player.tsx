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

  const [isLandscape, setIsLandscape] = useState(false);
  const [score, setScore] = useState(0);

  // Check orientation
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        setIsLandscape(window.innerWidth > window.innerHeight);
      } else {
        setIsLandscape(false);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // If page is refreshed, find the game from store
  useEffect(() => {
    if (!currentGame && gameId) {
      const game = games.find(g => g.id === gameId);
      if (game) setCurrentGame(game);
      else navigate('/');
    }

    // Attempt to lock orientation to portrait
    const lockOrientation = async () => {
      try {
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('portrait');
        }
      } catch (error) {
        console.log('Orientation lock failed:', error);
      }
    };

    // Lock body scroll and prevent bounce
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    lockOrientation();

    return () => {
      // Restore body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
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
      {/* Rotation Overlay - Shows only in mobile landscape */}
      {isLandscape && (
        <div className="fixed inset-0 z-[100] bg-[#0A0B1A] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 mb-6 text-cyan-400 animate-bounce">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <path d="M12 18h.01" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">세로 모드로 돌려주세요</h2>
          <p className="text-gray-400">이 게임은 세로 모드에 최적화되어 있습니다.</p>
        </div>
      )}

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
