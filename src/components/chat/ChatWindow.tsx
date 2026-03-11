import React, { useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { useChatStore } from '../../hooks/useChatStore';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';

const ChatWindow: React.FC = () => {
  const { 
    messages, 
    isOpen, 
    toggleChat, 
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
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* Chat Window Container */}
      {isOpen ? (
        <div className="w-[320px] sm:w-[380px] h-[500px] bg-[#0f1123]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
          <ChatHeader onClose={toggleChat} />
          <ChatMessageList messages={messages} />
          <ChatInput onSendMessage={sendMessage} />
        </div>
      ) : (
        /* Floating Bubble */
        <button
          onClick={toggleChat}
          className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-2xl shadow-[0_10px_30px_rgba(14,165,233,0.4)] hover:shadow-[0_15px_40px_rgba(14,165,233,0.6)] hover:-translate-y-1 transition-all active:scale-95 group relative"
        >
          <MessageSquare className="text-white group-hover:scale-110 transition-transform" size={24} />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>
        </button>
      )}
    </div>
  );
};

export default ChatWindow;
