import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../hooks/useGameStore';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BarChart2, Gamepad2, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { PortalBackground } from '../components/layout/PortalBackground';
import { Header } from '../components/layout/Header';
import { GameStatsChart } from '../components/stats/GameStatsChart';

const AdminDashboard: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const games = useGameStore((state) => state.games);
    const playCounts = useGameStore((state) => state.playCounts);
    const dailyStats = useGameStore((state) => state.dailyStats);
    const fetchPlayCounts = useGameStore((state) => state.fetchPlayCounts);
    const fetchDailyStats = useGameStore((state) => state.fetchDailyStats);
    
    const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

    useEffect(() => {
        fetchPlayCounts();
    }, [fetchPlayCounts]);

    const handleToggleTrends = async (gameId: string) => {
        if (expandedGameId === gameId) {
            setExpandedGameId(null);
        } else {
            setExpandedGameId(gameId);
            if (!dailyStats[gameId]) {
                await fetchDailyStats(gameId);
            }
        }
    };

    const totalPlays = Object.values(playCounts).reduce((sum, count) => sum + count, 0);
    const sortedGames = [...games].sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0));

    return (
        <div className="min-h-screen relative z-0">
            <PortalBackground />
            <Header />

            <main className="relative pt-32 pb-12 px-6 max-w-6xl mx-auto z-10 w-full">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-slate-500 hover:text-cyan-400 transition-colors mb-8 group"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium">{t('community.back_home')}</span>
                </button>

                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2 uppercase italic">
                        Admin <span className="text-cyan-400">Dashboard</span>
                    </h1>
                    <p className="text-slate-400 font-light">
                        시스템 현황 및 통계 모니터링
                    </p>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-cyan-500/20 rounded-2xl">
                                <TrendingUp className="text-cyan-400" size={24} />
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Total Plays</p>
                                <p className="text-2xl font-black text-white">{totalPlays.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-purple-500/20 rounded-2xl">
                                <Gamepad2 className="text-purple-400" size={24} />
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Active Games</p>
                                <p className="text-2xl font-black text-white">{games.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-pink-500/20 rounded-2xl">
                                <BarChart2 className="text-pink-400" size={24} />
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Avg. Plays / Game</p>
                                <p className="text-2xl font-black text-white">
                                    {Math.round(totalPlays / (games.length || 1)).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Game Stats Table / Cards */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <BarChart2 size={24} className="text-cyan-400" />
                            Game Performance
                        </h2>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/5">
                                    <th className="px-6 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Game ID</th>
                                    <th className="px-6 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest text-right">Plays</th>
                                    <th className="px-6 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest text-right">Popularity</th>
                                    <th className="px-6 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest text-center">Trends</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sortedGames.map((game) => {
                                    const count = playCounts[game.id] || 0;
                                    const percentage = totalPlays > 0 ? (count / totalPlays) * 100 : 0;
                                    const isExpanded = expandedGameId === game.id;
                                    
                                    return (
                                        <React.Fragment key={game.id}>
                                            <tr className={`hover:bg-white/[0.02] transition-colors ${isExpanded ? 'bg-white/[0.03]' : ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center">
                                                            <Gamepad2 size={16} className="text-cyan-400" />
                                                        </div>
                                                        <span className="font-bold text-white uppercase tracking-tight">{game.id}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="font-mono text-cyan-400 font-bold">{count.toLocaleString()}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-3 text-right">
                                                        <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500" 
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-500 w-12">{percentage.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button 
                                                        onClick={() => handleToggleTrends(game.id)}
                                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-400 transition-all"
                                                    >
                                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-white/5 animate-in slide-in-from-top-2 duration-300">
                                                    <td colSpan={4} className="px-8 py-8 border-t border-white/5">
                                                        <div className="flex flex-col gap-6">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                                    <TrendingUp size={14} className="text-cyan-400" />
                                                                    Daily Play Trends (Last 30 Days)
                                                                </h4>
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold px-3 py-1 bg-white/5 rounded-full border border-white/5">
                                                                    Max: {Math.max(...(dailyStats[game.id]?.map(d => d.playCount) || [0])).toLocaleString()} plays / day
                                                                </div>
                                                            </div>
                                                            <div className="h-[250px] w-full p-6 bg-black/40 rounded-3xl border border-white/10 shadow-inner">
                                                                <GameStatsChart 
                                                                    data={dailyStats[game.id] || []} 
                                                                    height={250} 
                                                                    color="#22d3ee" 
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="md:hidden divide-y divide-white/5">
                        {sortedGames.map((game) => {
                            const count = playCounts[game.id] || 0;
                            const percentage = totalPlays > 0 ? (count / totalPlays) * 100 : 0;
                            const isExpanded = expandedGameId === game.id;

                            return (
                                <div key={game.id} className={`flex flex-col transition-colors ${isExpanded ? 'bg-white/[0.03]' : ''}`}>
                                    <div 
                                        className="p-5 flex items-center justify-between cursor-pointer active:bg-white/5"
                                        onClick={() => handleToggleTrends(game.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                                                <Gamepad2 size={20} className="text-cyan-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white uppercase tracking-tight text-sm">{game.id}</h3>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{count.toLocaleString()} Plays</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right flex flex-col items-end gap-1">
                                                <span className="text-xs font-mono font-bold text-cyan-400">{percentage.toFixed(1)}%</span>
                                                <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-cyan-400" 
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-slate-500">
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile Expanded Trends */}
                                    {isExpanded && (
                                        <div className="px-5 pb-6 animate-in slide-in-from-top-2 duration-300">
                                            <div className="flex flex-col gap-4 p-4 bg-black/40 rounded-2xl border border-white/5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <TrendingUp size={11} />
                                                        Daily Trends (30D)
                                                    </h4>
                                                    <span className="text-[9px] text-slate-500 uppercase font-bold">
                                                        MAX: {Math.max(...(dailyStats[game.id]?.map(d => d.playCount) || [0]))}
                                                    </span>
                                                </div>
                                                <div className="h-[150px] w-full">
                                                    <GameStatsChart 
                                                        data={dailyStats[game.id] || []} 
                                                        height={150} 
                                                        color="#22d3ee" 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>

            <footer className="relative py-12 px-6 mt-12 bg-black/30 backdrop-blur-sm border-t border-white/5">
                <div className="max-w-6xl mx-auto text-center">
                    <p className="text-slate-600 text-[10px] uppercase tracking-tighter">
                        © {new Date().getFullYear()} WCGames Admin Portal. Confidential.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default AdminDashboard;
