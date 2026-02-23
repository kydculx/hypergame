import React, { useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { UserProfile } from './UserProfile';
import Leaderboard from '../Leaderboard';

export const Header: React.FC = () => {
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

    // Apply a scroll listener for a more dynamic header
    const [scrolled, setScrolled] = useState(false);

    React.useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    React.useEffect(() => {
        if (isLeaderboardOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        // Cleanup in case component unmounts while modal is open
        return () => {
            document.body.style.overflow = '';
        };
    }, [isLeaderboardOpen]);

    return (
        <>
            <header className={`fixed top-0 left-0 w-full z-40 transition-all duration-500 border-b ${scrolled ? 'bg-[#0A0B1A]/80 backdrop-blur-xl border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] py-3' : 'bg-transparent border-transparent py-5'}`}>
                <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-8">
                    {/* Logo Container */}
                    <div
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="flex items-center gap-3 cursor-pointer group"
                    >
                        <div className={`p-1 transition-all duration-300 ${scrolled ? 'bg-white/10 border border-white/10 shadow-lg' : 'bg-transparent border border-transparent'} rounded-full backdrop-blur-md group-hover:bg-white/20 group-hover:border-white/30 group-hover:scale-105 flex items-center justify-center`}>
                            <img src="/images/wc-icon.png" alt="WCGames" className="w-9 h-9 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all duration-300 group-hover:drop-shadow-[0_0_12px_rgba(14,165,233,0.6)]" style={{ borderRadius: '50%' }} />
                        </div>
                        <span className="font-extrabold text-white text-2xl tracking-tight hidden sm:block drop-shadow-md group-hover:text-cyan-400 transition-colors">
                            WCGames
                        </span>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-3 md:gap-4 bg-white/5 border border-white/10 rounded-full p-1.5 backdrop-blur-md shadow-inner transition-colors hover:bg-white/10 hover:border-white/20">
                        {/* Leaderboard Button */}
                        <button
                            onClick={() => setIsLeaderboardOpen(true)}
                            className="bg-black/20 hover:bg-amber-500/20 p-2 md:p-2.5 rounded-full text-amber-500 hover:text-amber-400 transition-all duration-300 flex items-center justify-center group/btn"
                            title="Leaderboard"
                        >
                            <Trophy size={18} className="drop-shadow-sm group-hover/btn:scale-110 transition-transform" />
                        </button>

                        <div className="w-[1px] h-6 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>

                        {/* User Profile */}
                        <div className="pr-1">
                            <UserProfile />
                        </div>
                    </div>
                </div>
            </header>

            {/* Leaderboard Modal */}
            {isLeaderboardOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
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
        </>
    );
};
