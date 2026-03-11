import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ChatMessage from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '../../hooks/useChatStore';

interface ChatMessageListProps {
  messages: ChatMessageType[];
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages }) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 hidden-scrollbar bg-black/5 overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      {messages.length > 0 ? (
        messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50">
          <p className="text-xs">{t('chat.no_messages')}</p>
          <p className="text-[10px]">{t('chat.first_hello')}</p>
        </div>
      )}
    </div>
  );
};

export default ChatMessageList;
