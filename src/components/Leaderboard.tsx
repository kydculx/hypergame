import React from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { Trophy, Medal, Clock } from 'lucide-react';

const Leaderboard: React.FC = () => {
  const { games, leaderboard } = useGameStore();

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="text-amber-400" size={32} />
        <h2 className="text-3xl font-black tracking-tight uppercase">Leaderboards</h2>
      </div>

      <div className="space-y-12">
        {games.map((game) => {
          const scores = leaderboard[game.id] || [];
          
          return (
            <div key={game.id}>
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                <h3 className="text-xl font-bold text-indigo-400">{game.title}</h3>
                <span className="text-xs text-gray-500 uppercase tracking-widest">Top 5 Records</span>
              </div>

              {scores.length > 0 ? (
                <div className="space-y-2">
                  {scores.map((entry, index) => (
                    <div 
                      key={entry.date} 
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        index === 0 ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 flex justify-center">
                          {index === 0 && <Trophy size={18} className="text-amber-400" />}
                          {index === 1 && <Medal size={18} className="text-slate-400" />}
                          {index === 2 && <Medal size={18} className="text-amber-700" />}
                          {index > 2 && <span className="text-gray-500 font-mono text-sm">{index + 1}</span>}
                        </div>
                        <span className={`font-medium ${index === 0 ? 'text-amber-200' : 'text-gray-200'}`}>
                          {entry.userId}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Clock size={12} />
                          <span className="text-[10px] font-mono">
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={`font-mono font-bold text-lg ${
                          index === 0 ? 'text-amber-400' : 'text-indigo-300'
                        }`}>
                          {entry.score.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-sm italic py-4">No records yet. Be the first to play!</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Leaderboard;
