import React, { useEffect, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { Trophy, Medal, Clock } from 'lucide-react';

const Leaderboard: React.FC = () => {
  const { games, leaderboard, fetchLeaderboard } = useGameStore();
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch latest global scores for all games when leaderboard opens
    games.forEach(game => {
      fetchLeaderboard(game.id);
    });

    if (games.length > 0 && !activeGameId) {
      setActiveGameId(games[0].id);
    }
  }, [games, fetchLeaderboard, activeGameId]);

  const activeGame = games.find(g => g.id === activeGameId) || games[0];
  const scores = activeGame ? (leaderboard[activeGame.id] || []) : [];

  return (
    <div className="bg-[#0f1123]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col h-[600px] sm:h-[650px] max-h-[85vh] w-full">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="bg-amber-500/20 p-2 rounded-xl">
          <Trophy className="text-amber-400" size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white uppercase leading-none">Global Rankings</h2>
          <p className="text-slate-400 text-xs mt-1">Top players across all games</p>
        </div>
      </div>

      {/* Game Selection Tabs */}
      <div className="flex overflow-x-auto hidden-scrollbar gap-2 mb-6 pb-2 shrink-0 border-b border-white/5">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => setActiveGameId(game.id)}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all duration-200 ${activeGameId === game.id
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]'
              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
          >
            {game.title}
          </button>
        ))}
      </div>

      {/* Active Game Leaderboard */}
      <div className="flex-1 overflow-y-auto hidden-scrollbar h-[550px] sm:h-[600px]">
        {activeGame && (
          <div className="animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#0f1123]/95 backdrop-blur-sm pb-2 z-10">
              <h3 className="text-lg font-bold text-cyan-400">{activeGame.title} Top 10</h3>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold bg-white/5 px-2 py-1 rounded-md">Live Data</span>
            </div>

            {scores.length > 0 ? (
              <div className="space-y-2">
                {scores.map((entry, index) => (
                  <div
                    key={`${entry.userId}-${entry.date}`}
                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${index === 0 ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border border-amber-500/30 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' : 'bg-white/5 border border-white/5 hover:bg-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center shrink-0">
                        {index === 0 && <Trophy size={20} className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" />}
                        {index === 1 && <Medal size={20} className="text-slate-300 drop-shadow-[0_0_5px_rgba(203,213,225,0.4)]" />}
                        {index === 2 && <Medal size={20} className="text-amber-700/80 drop-shadow-[0_0_5px_rgba(180,83,9,0.4)]" />}
                        {index > 2 && <span className="text-slate-500 font-mono text-sm font-bold bg-black/30 w-6 h-6 rounded-full flex items-center justify-center">{index + 1}</span>}
                      </div>
                      <span className={`font-bold text-sm ${index === 0 ? 'text-amber-300' : 'text-slate-200'}`}>
                        {entry.userId}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-1.5 text-slate-500 bg-black/20 px-2 py-1 rounded-md">
                        <Clock size={10} />
                        <span className="text-[9px] font-mono tracking-wider">
                          {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <span className={`font-mono font-black text-lg sm:text-xl tracking-tight ${index === 0 ? 'text-amber-400' : 'text-blue-300'
                        }`}>
                        {entry.score.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center bg-white/5 rounded-xl border border-white/5 border-dashed">
                <Trophy className="text-slate-600 mb-3" size={32} />
                <p className="text-slate-400 text-sm font-medium">No records yet.</p>
                <p className="text-cyan-600 text-xs mt-1">Be the first to claim the #1 spot!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
