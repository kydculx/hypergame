import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { PortalBackground } from '../components/layout/PortalBackground';
import { AuthModal } from '../components/layout/AuthModal';
import PostList from '../components/community/PostList';
import PostForm from '../components/community/PostForm';
import { useUserStore } from '../hooks/useUserStore';

const Community: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = useUserStore((state) => state.user);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handlePostCreated = () => {
        setIsFormOpen(false);
        setRefreshTrigger(prev => prev + 1);
    };

    const handleWriteClick = () => {
        if (!user) {
            setIsAuthModalOpen(true);
            return;
        }
        setIsFormOpen(true);
    };

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

                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2">
                            {t('community.title')}
                        </h1>
                        <p className="text-slate-400 font-light">
                            {t('community.subtitle')}
                        </p>
                    </div>

                    <button
                        onClick={handleWriteClick}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 hover:scale-105 transition-transform active:scale-95"
                    >
                        {t('community.write')}
                    </button>
                </div>

                <PostList key={refreshTrigger} />
            </main>

            {isFormOpen && (
                <PostForm
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={handlePostCreated}
                />
            )}

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />

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

export default Community;
