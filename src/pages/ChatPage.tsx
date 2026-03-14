import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PortalBackground } from '../components/layout/PortalBackground';
import { Header } from '../components/layout/Header';
import { useChatStore } from '../hooks/useChatStore';
import ChatMessageList from '../components/chat/ChatMessageList';
import ChatInput from '../components/chat/ChatInput';

const ChatPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { 
        messages, 
        sendMessage, 
        fetchMessages, 
        subscribeToMessages 
    } = useChatStore();

    useEffect(() => {
        fetchMessages();
        const unsubscribe = subscribeToMessages() as (() => void);
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [fetchMessages, subscribeToMessages]);

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
                        {t('chat.title')}
                    </h1>
                    <p className="text-slate-400 font-light">
                        {t('chat.subtitle') || '실시간 글로벌 커뮤니케이션'}
                    </p>
                </div>

                {/* Chat Container */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl w-full h-[600px] mb-8">
                    <ChatMessageList messages={messages} />
                    <div className="p-4 bg-black/20 border-t border-white/5">
                        <ChatInput onSendMessage={sendMessage} />
                    </div>
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

export default ChatPage;
