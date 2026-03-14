import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { PortalBackground } from '../components/layout/PortalBackground';
import Leaderboard from '../components/Leaderboard';

const LeaderboardPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen relative z-0">
            <PortalBackground />
            <Header />

            <main className="relative pt-32 pb-12 px-6 max-w-4xl mx-auto z-10 w-full">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-slate-500 hover:text-cyan-400 transition-colors mb-8 group"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium">{t('community.back_home')}</span>
                </button>

                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2">
                        {t('header.leaderboard')}
                    </h1>
                    <p className="text-slate-400 font-light">
                        {t('board.subtitle')}
                    </p>
                </div>

                <div className="w-full">
                    <Leaderboard />
                </div>
            </main>

            <footer className="relative py-12 px-6 mt-12 bg-black/30 backdrop-blur-sm border-t border-white/5">
                <div className="max-w-6xl mx-auto text-center">
                    <p className="text-slate-600 text-[10px] uppercase tracking-tighter">
                        © {new Date().getFullYear()} WCGames. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LeaderboardPage;
