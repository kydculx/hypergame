import React, { useState } from 'react';
import { Globe, BarChart2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile } from './UserProfile';
import { usePresence } from '../../hooks/usePresence';
import { useUserStore } from '../../hooks/useUserStore';

export const Header: React.FC = () => {
    const { onlineCount } = usePresence();
    const { i18n, t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isAdmin = useUserStore((state) => state.isAdmin);

    // Apply a scroll listener for a more dynamic header
    const [scrolled, setScrolled] = useState(false);

    React.useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogoClick = () => {
        if (location.pathname === '/') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            navigate('/');
        }
    };

    return (
        <>
            <header className={`fixed top-0 left-0 w-full z-40 transition-all duration-500 border-b ${scrolled ? 'bg-[#0A0B1A]/80 backdrop-blur-xl border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] py-3' : 'bg-transparent border-transparent py-5'}`}>
                <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-8">
                    {/* Logo Container */}
                    <div
                        onClick={handleLogoClick}
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
                    <div className="flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 rounded-full p-1.5 backdrop-blur-md shadow-inner transition-colors hover:bg-white/10 hover:border-white/20">
                        {/* CCU Indicator */}
                        <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-full text-xs font-bold tracking-tight border border-white/5 shadow-inner">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                            </span>
                            <span className="text-white/40 uppercase text-[10px] hidden md:inline ml-0.5">{t('header.live_users')}</span>
                            <span className="text-cyan-400 ml-0.5">{onlineCount}</span>
                        </div>

                        <div className="w-[1px] h-6 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>

                        {/* Admin Dashboard Link (Only if Admin) */}
                        {isAdmin && (
                            <>
                                <button
                                    onClick={() => navigate('/admin-stats')}
                                    className="flex items-center gap-1.5 bg-black/20 hover:bg-cyan-500/20 px-3 py-1.5 md:py-2 rounded-full text-cyan-400 hover:text-cyan-300 transition-all duration-300 group/admin font-bold text-xs tracking-wider"
                                    title="Admin Dashboard"
                                >
                                    <BarChart2 size={16} className="group-hover/admin:scale-110 transition-transform" />
                                    <span className="hidden lg:inline uppercase">Stats</span>
                                </button>
                                <div className="w-[1px] h-6 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                            </>
                        )}

                        {/* Language Selector */}
                        <button
                            onClick={() => {
                                const newLng = i18n.language.startsWith('ko') ? 'en' : 'ko';
                                i18n.changeLanguage(newLng);
                                // Broadcast language change to iframe games
                                const message = { type: 'LANGUAGE_CHANGED', payload: { lang: newLng } };
                                document.querySelectorAll('iframe').forEach(iframe => {
                                    if (iframe.contentWindow) iframe.contentWindow.postMessage(message, '*');
                                });
                            }}
                            className="flex items-center gap-1.5 bg-black/20 hover:bg-cyan-500/20 px-3 py-1.5 md:py-2 rounded-full text-cyan-400 hover:text-cyan-300 transition-all duration-300 group/lang font-bold text-sm tracking-wide"
                            title="Toggle Language"
                        >
                            <Globe size={16} className="drop-shadow-sm group-hover/lang:rotate-12 transition-transform" />
                            <span className="uppercase">{i18n.language.startsWith('ko') ? 'KO' : 'EN'}</span>
                        </button>

                        {/* User Profile */}
                        <div className="pr-1">
                            <UserProfile />
                        </div>
                    </div>
                </div>
            </header>

            {/* Leaderboard Modal removed as it's now a full page */}
        </>
    );
};
