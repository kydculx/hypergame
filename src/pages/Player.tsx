import React, { useEffect, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../hooks/useUserStore';
import Leaderboard from '../components/Leaderboard';

const Player: React.FC = () => {
  const { t } = useTranslation();
  const { gameId } = useParams<{ gameId: string }>();
  const currentGame = useGameStore((state) => state.currentGame);
  const games = useGameStore((state) => state.games);
  const setCurrentGame = useGameStore((state) => state.setCurrentGame);
  const addScore = useGameStore((state) => state.addScore);
  const incrementPlayCount = useGameStore((state) => state.incrementPlayCount);
  const navigate = useNavigate();

  const [sessionKey] = useState(() => Math.random().toString(36).substring(2, 15));
  const [isLandscape, setIsLandscape] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const hasIncremented = React.useRef<string | null>(null);

  // Resolution & Orientation Helper
  const getGameDimensions = () => {
    if (!currentGame) return { width: 480, height: 854, orientation: 'portrait' as const };

    const isLandscape = currentGame.orientation === 'landscape';
    const gConfig = window.WCGamesConfig?.GAME_DIMENSIONS;
    const defaults = isLandscape
      ? (gConfig?.LANDSCAPE || { width: 854, height: 480 })
      : (gConfig?.PORTRAIT || { width: 480, height: 854 });

    return {
      width: currentGame.width || defaults.width,
      height: currentGame.height || defaults.height,
      orientation: currentGame.orientation || 'portrait'
    };
  };

  // Check orientation mismatch
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && currentGame) {
        const deviceIsLandscape = window.innerWidth > window.innerHeight;
        const gameNeedsLandscape = currentGame.orientation === 'landscape';
        // Mismatch if game is portrait but device is landscape, OR game is landscape but device is portrait
        setIsLandscape(gameNeedsLandscape ? !deviceIsLandscape : deviceIsLandscape);
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
  }, [currentGame]);

  // If page is refreshed, find the game from store
  useEffect(() => {
    if (!currentGame && gameId) {
      const game = games.find(g => g.id === gameId);
      if (game) setCurrentGame(game);
      else navigate('/');
    }

    // Attempt to lock orientation
    const lockOrientation = async () => {
      try {
        if (screen.orientation && (screen.orientation as any).lock && currentGame) {
          await (screen.orientation as any).lock(currentGame.orientation || 'portrait');
        }
      } catch {
        // Orientation lock is not supported on most desktop browsers
      }
    };

    // Lock body scroll and prevent bounce
    document.body.classList.add('no-scroll');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    lockOrientation();

    return () => {
      // Restore body scroll
      document.body.classList.remove('no-scroll');
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [gameId, currentGame, games, setCurrentGame, navigate]);

  // Increment play count once per session
  useEffect(() => {
    if (gameId && hasIncremented.current !== gameId) {
      incrementPlayCount(gameId);
      hasIncremented.current = gameId;
    }
  }, [gameId, incrementPlayCount]);

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
        case 'SHOW_LEADERBOARD':
          setIsLeaderboardOpen(true);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [gameId, addScore, sessionKey]);

  const user = useUserStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const isPopup = searchParams.get('popup') === 'true';

  // Robust Handheld (Phone/Tablet) Detection
  const isHandheld = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth < 1366);

  if (!currentGame) return null;
  const userEmail = user?.email || '';

  const gameUrlWithKey = currentGame.gameUrl.includes('?')
    ? `${currentGame.gameUrl}&sk=${sessionKey}&u=${encodeURIComponent(userEmail)}`
    : `${currentGame.gameUrl}?sk=${sessionKey}&u=${encodeURIComponent(userEmail)}`;

  // If it's a popup, we want it to fill the entire window without the "mobile box" styling
  const dims = getGameDimensions();

  const containerStyle = isPopup
    ? {
      width: `${dims.width}px`,
      height: `${dims.height}px`,
      minWidth: `${dims.width}px`,
      minHeight: `${dims.height}px`,
      flexShrink: 0,
      margin: 'auto'
    }
    : (isHandheld ? {
      width: '100%',
      height: '100%',
    } : {
      aspectRatio: `${dims.width} / ${dims.height}`,
      maxWidth: `${dims.width}px`,
      maxHeight: `min(90vh, ${dims.height}px)`,
      overscrollBehavior: 'none' as const,
      touchAction: 'none' as const
    });

  const containerClasses = isPopup
    ? `relative bg-black flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] ring-1 ring-white/10`
    : (isHandheld
      ? `relative w-full h-full bg-black flex flex-col overflow-hidden`
      : `relative w-full h-full md:h-auto bg-black flex flex-col md:shadow-[0_0_100px_rgba(0,0,0,0.8)] md:border-x md:border-white/5 md:rounded-2xl overflow-hidden`);

  const wrapperClasses = isPopup
    ? "fixed inset-0 bg-[#05060f] flex items-center justify-center overflow-hidden overscroll-none"
    : (isHandheld
      ? "fixed inset-0 bg-black flex flex-col overflow-hidden overscroll-none touch-none"
      : "fixed inset-0 bg-[#05060f] flex justify-center md:items-center overflow-hidden overscroll-none touch-none");

  return (
    <div className={wrapperClasses}>
      <div
        className={containerClasses}
        style={containerStyle}
      >
        {/* Rotation Overlay - Shows only when orientation mismatch occurs */}
        {isLandscape && (
          <div className="fixed inset-0 z-[100] bg-[#0A0B1A] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            <div className={`mb-6 text-cyan-400 animate-bounce ${dims.orientation === 'landscape' ? 'rotate-90' : ''}`}>
              <svg className="w-20 h-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <path d="M12 18h.01" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {dims.orientation === 'landscape' ? t('player.rotate_landscape_title') : t('player.rotate_title')}
            </h2>
            <p className="text-gray-400">
              {dims.orientation === 'landscape' ? t('player.rotate_landscape_desc') : t('player.rotate_desc')}
            </p>
          </div>
        )}

        {/* Absolute UI Layer for Relative Positioning within Safe Area */}
        {!isPopup && (
          <div
            className="pointer-events-none absolute inset-0 z-50 flex flex-col justify-start items-end"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingRight: 'calc(env(safe-area-inset-right) + 0.5rem)',
            }}
          >
            {/* Close Button - Now positioned relative to Safe Area */}
            <button
              onClick={() => navigate('/')}
              className="pointer-events-auto p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all backdrop-blur-sm"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Game Container - Fills the dynamic viewport completely */}
        <div className="flex-1 relative bg-gray-900 border-none outline-none">
          <iframe
            src={gameUrlWithKey}
            className="w-full h-full border-none"
            title={t(`games.${currentGame.id}.title`)}
            allow="autoplay; fullscreen"
          />
        </div>

      </div>

      {/* Leaderboard Modal */}
      {isLeaderboardOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsLeaderboardOpen(false)}
          ></div>

          {/* Modal Content */}
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto hidden-scrollbar rounded-2xl animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsLeaderboardOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
            >
              <X size={24} />
            </button>
            <Leaderboard />
          </div>
        </div>
      )}
    </div>
  );
};

export default Player;
