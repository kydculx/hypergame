import React from 'react';
import { MessageSquare, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChatHeaderProps {
  onClose: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5 shrink-0">
      <div className="flex items-center gap-2">
        <div className="bg-cyan-500/20 p-1.5 rounded-lg">
          <MessageSquare size={18} className="text-cyan-400" />
        </div>
        <h3 className="font-bold text-sm text-white uppercase tracking-tight">
          {t('chat.title')}
        </h3>
      </div>
      <button 
        onClick={onClose}
        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
      >
        <Minus size={18} />
      </button>
    </div>
  );
};

export default ChatHeader;
