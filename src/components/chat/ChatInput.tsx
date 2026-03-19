import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSending) return;

    setIsSending(true);
    await onSendMessage(content);
    setContent('');
    setIsSending(false);
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="p-3 border-t border-white/10 bg-white/5 flex gap-2 shrink-0"
    >
      <div className="flex-1 relative">
        <input
          type="text"
          value={content}
          maxLength={50}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('chat.placeholder')}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 pr-12 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
          disabled={isSending}
        />
        {content.length > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-mono">
            {content.length}/50
          </span>
        )}
      </div>
      <button
        type="submit"
        disabled={!content.trim() || isSending}
        className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 p-2 rounded-xl transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:shadow-[0_0_20px_rgba(14,165,233,0.5)] active:scale-95"
      >
        <Send size={18} className="text-white" />
      </button>
    </form>
  );
};

export default ChatInput;
