import React from 'react';
import { useUserStore } from '../../hooks/useUserStore';
import type { ChatMessage as ChatMessageType } from '../../hooks/useChatStore';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { userName } = useUserStore();
  const isMe = message.user_name === userName;

  return (
    <div className={`flex flex-col mb-3 ${isMe ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className={`text-[10px] font-bold ${isMe ? 'text-cyan-400' : 'text-slate-400'}`}>
          {message.user_name}
        </span>
        <span className="text-[8px] text-slate-600 font-mono">
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] break-words ${
        isMe 
          ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-50 shadow-[0_2px_10px_rgba(14,165,233,0.1)] rounded-tr-none' 
          : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
      }`}>
        {message.content}
      </div>
    </div>
  );
};

export default ChatMessage;
