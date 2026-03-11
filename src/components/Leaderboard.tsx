import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { useUserStore } from '../hooks/useUserStore';
import { Trophy, Medal, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Leaderboard: React.FC = () => {
  const { t } = useTranslation();
  const { games, leaderboard, userRanks, fetchLeaderboard, fetchUserRank } = useGameStore();
  const { userName, user } = useUserStore();
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasDragged = useRef(false);

  useEffect(() => {
    // Fetch latest global scores for all games when leaderboard opens
    games.forEach(game => {
      fetchLeaderboard(game.id);
      fetchUserRank(game.id);
    });

    if (games.length > 0 && !activeGameId) {
      setActiveGameId(games[0].id);
    }
  }, [games, fetchLeaderboard, activeGameId]);

  const activeGame = games.find(g => g.id === activeGameId) || games[0];
  const scores = activeGame ? (leaderboard[activeGame.id] || []) : [];

  const userRankIndex = scores.findIndex(s => s.userId === userName);
  const isRankedInTop30 = userRankIndex !== -1;
  const userGlobalRank = userRanks[activeGame?.id || ''];
  const userScore = isRankedInTop30 ? scores[userRankIndex].score : 0;

  const renderScore = (gameId: string | undefined, score: number) => {
    if (gameId === 'minesweeper') {
      if (score === 0) return '---';

      const minutes = Math.floor(score / 60);
      const seconds = score % 60;
      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }
      return `${score}s`;
    } else if (gameId === 'bulletdodge') {
      return (score / 100).toFixed(2) + 's';
    }
    return score.toLocaleString();
  };

  return (
    <div className="bg-[#0f1123]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col h-[600px] sm:h-[650px] max-h-[85vh] w-full">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="bg-amber-500/20 p-2 rounded-xl">
          <Trophy className="text-amber-400" size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white uppercase leading-none">{t('board.title')}</h2>
          <p className="text-slate-400 text-xs mt-1">{t('board.subtitle')}</p>
        </div>
      </div>

      {/* Game Selection Tabs - drag & wheel scroll */}
      <div
        ref={tabsRef}
        className={`flex overflow-x-auto hidden-scrollbar gap-2 mb-6 pb-2 shrink-0 border-b border-white/5 select-none ${isDragging.current ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={(e) => {
          if (tabsRef.current) {
            e.preventDefault();
            tabsRef.current.scrollLeft += e.deltaY;
          }
        }}
        onMouseDown={(e) => {
          isDragging.current = true;
          hasDragged.current = false;
          dragStartX.current = e.pageX;
          scrollStartX.current = tabsRef.current?.scrollLeft ?? 0;
        }}
        onMouseMove={(e) => {
          if (!isDragging.current || !tabsRef.current) return;
          const dx = e.pageX - dragStartX.current;
          if (Math.abs(dx) > 3) hasDragged.current = true;
          tabsRef.current.scrollLeft = scrollStartX.current - dx;
        }}
        onMouseUp={() => { isDragging.current = false; }}
        onMouseLeave={() => { isDragging.current = false; }}
      >
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => {
              if (!hasDragged.current) setActiveGameId(game.id);
            }}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all duration-200 ${activeGameId === game.id
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]'
              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
          >
            {t(`games.${game.id}.title`)}
          </button>
        ))}
      </div>

      {/* Active Game Leaderboard */}
      <div className="flex-1 overflow-y-auto hidden-scrollbar h-[550px] sm:h-[600px]">
        {activeGame && (
          <div className="animate-in fade-in duration-300">
            {scores.length > 0 ? (
              <div className="space-y-2">
                {scores.map((entry, index) => (
                  <div
                    key={`${entry.userId}-${entry.date}`}
                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${index === 0 ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border border-amber-500/30 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' : 'bg-white/5 border border-white/5 hover:bg-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-3 w-[55%]">
                      <div className="w-6 sm:w-8 flex justify-center shrink-0">
                        {index === 0 && <Trophy size={18} className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)] sm:w-5 sm:h-5" />}
                        {index === 1 && <Medal size={18} className="text-slate-300 drop-shadow-[0_0_5px_rgba(203,213,225,0.4)] sm:w-5 sm:h-5" />}
                        {index === 2 && <Medal size={18} className="text-amber-700/80 drop-shadow-[0_0_5px_rgba(180,83,9,0.4)] sm:w-5 sm:h-5" />}
                        {index > 2 && <span className="text-slate-500 font-mono text-[10px] sm:text-sm font-bold bg-black/30 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center">{index + 1}</span>}
                      </div>
                      <span className={`font-bold text-xs sm:text-sm truncate w-full ${index === 0 ? 'text-amber-300' : 'text-slate-200'}`} title={entry.userId}>
                        {entry.userId}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-4 shrink-0">
                      <div className="flex items-center gap-1 sm:gap-1.5 text-slate-500 bg-black/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md mb-0.5 sm:mb-0">
                        <Clock size={8} className="sm:hidden" />
                        <Clock size={10} className="hidden sm:block" />
                        <span className="text-[8px] sm:text-[9px] font-mono tracking-wider">
                          {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <span className={`font-mono font-black text-sm sm:text-xl tracking-tight ${index === 0 ? 'text-amber-400' : 'text-blue-300'
                        }`}>
                        {renderScore(activeGame?.id, entry.score)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center bg-white/5 rounded-xl border border-white/5 border-dashed">
                <Trophy className="text-slate-600 mb-3" size={32} />
                <p className="text-slate-400 text-sm font-medium">{t('board.empty_title')}</p>
                <p className="text-cyan-600 text-xs mt-1">{t('board.empty_desc')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed My Rank Section - Only visible for logged-in users */}
      {user && (
        <div className="mt-4 pt-4 border-t border-white/10 shrink-0">
          <div className="bg-gradient-to-r from-cyan-900/40 to-[#0f1123] border border-cyan-500/30 rounded-xl p-3 flex items-center justify-between shadow-[0_0_15px_rgba(14,165,233,0.15)] relative overflow-hidden">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-cyan-500/5 mix-blend-overlay pointer-events-none"></div>

            <div className="flex items-center gap-3 relative z-10">
              <div className="w-8 flex justify-center shrink-0">
                {isRankedInTop30 ? (
                  userRankIndex === 0 ? <Trophy size={20} className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" /> :
                    userRankIndex === 1 ? <Medal size={20} className="text-slate-300 drop-shadow-[0_0_5px_rgba(203,213,225,0.4)]" /> :
                      userRankIndex === 2 ? <Medal size={20} className="text-amber-700/80 drop-shadow-[0_0_5px_rgba(180,83,9,0.4)]" /> :
                        <span className="text-cyan-400 font-mono text-sm font-bold bg-cyan-950/80 border border-cyan-500/30 w-7 h-7 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(14,165,233,0.3)]">{userRankIndex + 1}</span>
                ) : userGlobalRank > 0 ? (
                  <span className="text-cyan-400 font-mono text-[11px] font-bold bg-cyan-950/80 border border-cyan-500/30 min-w-[28px] h-7 px-1.5 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(14,165,233,0.3)]">{userGlobalRank}</span>
                ) : (
                  <span className="text-slate-500 font-mono text-sm font-bold bg-black/50 border border-white/10 w-7 h-7 rounded-full flex items-center justify-center">-</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-cyan-300">{t('board.my_rank')}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-500/20">{userName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 relative z-10">
              <span className={`font-mono font-black text-lg sm:text-xl tracking-tight ${isRankedInTop30 || userGlobalRank > 0 ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.6)]' : 'text-slate-500'}`}>
                {isRankedInTop30 ? renderScore(activeGame?.id, userScore) : userGlobalRank > 0 ? renderScore(activeGame?.id, useGameStore.getState().personalBests[activeGame?.id || '']) : '---'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
