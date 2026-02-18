import React, { useState } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { User, Edit2, Check, X } from 'lucide-react';

const UserProfile: React.FC = () => {
  const { userProfile, setNickname } = useGameStore();
  const [isEditing, setIsEditing] = useState(false);
  const [tempNickname, setTempNickname] = useState(userProfile.nickname);
  const [showToast, setShowToast] = useState(false);

  const handleSave = () => {
    const trimmed = tempNickname.trim();
    if (trimmed.length >= 2 && trimmed.length <= 12) {
      setNickname(trimmed);
      setIsEditing(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  };

  const handleCancel = () => {
    setTempNickname(userProfile.nickname);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-2 pl-4 pr-4 rounded-full shadow-lg">
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center shadow-inner"
        style={{ backgroundColor: userProfile.avatarColor }}
      >
        <User size={20} className="text-white drop-shadow-md" />
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={tempNickname}
            onChange={(e) => setTempNickname(e.target.value)}
            className="bg-gray-900 border border-indigo-500/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32 font-medium"
            autoFocus
            maxLength={12}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <button onClick={handleSave} className="p-1 hover:bg-green-500/20 text-green-400 rounded transition-colors">
            <Check size={16} />
          </button>
          <button onClick={handleCancel} className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-100 tracking-tight">
            {userProfile.nickname}
          </span>
          <button 
            onClick={() => setIsEditing(true)}
            className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all group"
          >
            <Edit2 size={14} className="group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      )}

      {showToast && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg shadow-green-500/50 animate-bounce z-50">
          NICKNAME UPDATED!
        </div>
      )}
    </div>
  );
};

export default UserProfile;
