import React, { useEffect, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Player: React.FC = () => {
  const { t } = useTranslation();
  const { gameId } = useParams<{ gameId: string }>();
  const currentGame = useGameStore((state) => state.currentGame);
  const games = useGameStore((state) => state.games);
  const setCurrentGame = useGameStore((state) => state.setCurrentGame);
  const addScore = useGameStore((state) => state.addScore);
  const navigate = useNavigate();

  const [sessionKey] = useState(() => Math.random().toString(36).substring(2, 15));
  const [isLandscape, setIsLandscape] = useState(false);

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
      } catch {
        // Orientation lock is not supported on most desktop browsers
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
      const { type, payload, score: topLevelScore } = event.data;

      // Unify the score from different game message formats
      const receivedScore = topLevelScore !== undefined ? topLevelScore : payload?.score;
      const signature = payload?.signature;

      // Verification Logic (Basic Anti-Cheat)
      const verifySignature = (score: number, sig: string) => {
        if (!sig) return false;
        // Logic must match wcgames-core.js
        const salt = "WCG_SECURE_VERIFIER_2024";
        const expected = btoa(score.toString() + sessionKey + salt).split('').reverse().join('');
        return sig === expected;
      };

      switch (type) {
        case 'SUBMIT_SCORE':
        case 'GAME_OVER':
          if (gameId && typeof receivedScore === 'number') {
            if (verifySignature(receivedScore, signature)) {
              addScore(gameId, receivedScore);
            } else {
              console.warn(`[Anti-Cheat] Blocked suspicious score submission for ${gameId}.`);
            }
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [gameId, addScore, sessionKey]);

  if (!currentGame) return null;

  // Append session key to game URL
  const gameUrlWithKey = currentGame.gameUrl.includes('?')
    ? `${currentGame.gameUrl}&sk=${sessionKey}`
    : `${currentGame.gameUrl}?sk=${sessionKey}`;

  return (
    <div className="fixed inset-0 bg-[#05060f] flex justify-center md:items-center overflow-hidden overscroll-none touch-none">
      <div
        className="relative w-full h-full md:h-[90vh] md:max-h-[800px] md:w-auto md:aspect-[9/16] md:max-w-[480px] bg-black flex flex-col md:shadow-[0_0_100px_rgba(0,0,0,0.8)] md:border-x md:border-white/5 md:rounded-2xl overflow-hidden"
        style={{
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
            <h2 className="text-2xl font-bold text-white mb-2">{t('player.rotate_title')}</h2>
            <p className="text-gray-400">{t('player.rotate_desc')}</p>
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
            src={gameUrlWithKey}
            className="w-full h-full border-none"
            title={t(`games.${currentGame.id}.title`)}
            allow="autoplay; fullscreen"
          />
        </div>
      </div>
    </div>
  );
};

export default Player;
