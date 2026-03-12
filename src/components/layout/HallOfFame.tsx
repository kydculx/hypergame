import React, { useEffect, useState } from 'react';
import { Trophy, Crown } from 'lucide-react';
import { useGameStore } from '../../hooks/useGameStore';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

interface TopRanker {
    gameId: string;
    userName: string;
    score: number;
}

export const HallOfFame: React.FC = () => {
    const { t } = useTranslation();
    const { games } = useGameStore();
    const [topRankers, setTopRankers] = useState<TopRanker[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTopRankers = async () => {
            const rankers: TopRanker[] = [];

            // Fetch top score for each game
            for (const game of games) {
                try {
                    const { data } = await supabase
                        .from('scores')
                        .select('user_name, score')
                        .eq('game_id', game.id)
                        .order('score', { ascending: game.sortOrder === 'asc' })
                        .limit(1);

                    if (data && data.length > 0) {
                        rankers.push({
                            gameId: game.id,
                            userName: data[0].user_name,
                            score: data[0].score
                        });
                    }
                } catch (e) {
                    console.error(`Error fetching top ranker for ${game.id}:`, e);
                }
            }

            setTopRankers(rankers);
        };

        if (games.length > 0) {
            fetchTopRankers().finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, [games]);

    if (topRankers.length === 0 && !isLoading) return null;

    const renderScore = (gameId: string, score: number) => {
        if (gameId === 'minesweeper') {
            const positiveScore = Math.abs(score);
            const minutes = Math.floor(positiveScore / 60);
            const seconds = positiveScore % 60;
            return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        } else if (gameId === 'bulletdodge') {
            return (score / 100).toFixed(2) + 's';
        }
        return score.toLocaleString();
    };

    // Duplicate rankers to ensure seamless infinite scroll
    // Triple it to ensure it covers very wide screens even with few items
    const marqueeItems = [...topRankers, ...topRankers, ...topRankers];

    return (
        <div className="max-w-[1400px] mx-auto px-4 mb-8 select-none">
            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.33%); }
                }
                .animate-marquee {
                    display: inline-flex;
                    animation: marquee 40s linear infinite;
                    will-change: transform;
                }
            `}</style>
            <div className="bg-black/60 border border-white/10 rounded-2xl backdrop-blur-md relative overflow-hidden flex items-stretch shadow-2xl h-16">
                {/* Label Section - Fixed on the left */}
                <div className="relative z-20 flex items-center px-6 bg-[#0A0B1A] border-r border-white/10 shadow-[4px_0_20px_rgba(0,0,0,0.5)] w-[180px] shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                            <Crown className="text-amber-400" size={18} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80 leading-none mb-1">
                                {t('home.honor_tier')}
                            </span>
                            <span className="text-sm font-black uppercase tracking-tight text-white whitespace-nowrap">
                                {t('home.hall_of_fame')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Fade Overlays for seamless entry/exit */}
                <div className="absolute left-[180px] top-0 bottom-0 w-16 bg-gradient-to-r from-[#0A0B1A] to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0A0B1A] to-transparent z-10 pointer-events-none"></div>

                {/* Loading Skeleton */}
                {isLoading ? (
                    <div className="flex-1 overflow-hidden h-full flex items-center px-10 gap-8 opacity-50">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={`skeleton-${i}`} className="flex flex-col gap-2 animate-pulse min-w-[150px]">
                                <div className="h-2.5 w-20 bg-slate-700 rounded"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-700"></div>
                                    <div className="h-3 w-16 bg-slate-700 rounded"></div>
                                    <div className="h-3 w-12 bg-slate-700 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Marquee Container */
                    <div className="flex-1 overflow-hidden h-full flex items-center py-2">
                        <div className="flex animate-marquee whitespace-nowrap">
                            {marqueeItems.map((item, idx) => (
                                <div
                                    key={`${item.gameId}-${idx}`}
                                    className="inline-flex items-center gap-4 px-10 border-r border-white/5 hover:bg-white/5 transition-colors duration-300"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-0.5">
                                            {t(`games.${item.gameId}.title`)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                                <Trophy size={12} className="text-amber-500" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-200">
                                                {item.userName}
                                            </span>
                                            <span className="text-sm font-mono font-black text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20 ml-1">
                                                {renderScore(item.gameId, item.score)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
