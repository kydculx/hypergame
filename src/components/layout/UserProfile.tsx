import React, { useState, useRef, useEffect } from 'react';
import { User, Check, X, Edit2 } from 'lucide-react';
import { useUserStore } from '../../hooks/useUserStore';

export const UserProfile: React.FC = () => {
    const { userName, setUserName } = useUserStore();
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(userName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (tempName.trim()) {
            setUserName(tempName.trim());
        } else {
            setTempName(userName); // Revert if empty
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setTempName(userName);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    if (isEditing) {
        return (
            <div className="bg-white rounded-full shadow-lg flex items-center p-1 pr-2 animate-fadeIn">
                <div className="bg-blue-100 p-2 rounded-full mr-2">
                    <User size={20} className="text-blue-500" />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none outline-none text-gray-800 font-medium w-24 text-sm"
                    maxLength={10}
                />
                <button onClick={handleSave} className="p-1 hover:text-green-500 transition-colors">
                    <Check size={16} />
                </button>
                <button onClick={handleCancel} className="p-1 hover:text-red-500 transition-colors">
                    <X size={16} />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => setIsEditing(true)}
            className="bg-white pl-2 pr-4 py-2 rounded-full shadow-lg flex items-center gap-3 hover:scale-105 transition-all duration-200 group"
        >
            <div className="bg-gray-100 p-2 rounded-full group-hover:bg-blue-100 transition-colors">
                <User size={20} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
            </div>
            <span className="font-bold text-gray-700 text-sm group-hover:text-blue-600 transition-colors max-w-[100px] truncate">
                {userName}
            </span>
            <Edit2 size={12} className="text-gray-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />
        </button>
    );
};
