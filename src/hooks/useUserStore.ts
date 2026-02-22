import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UserState {
    userName: string;
    user: User | null;
    setUserName: (name: string) => void;
    setUser: (user: User | null) => void;
    logout: () => Promise<void>;
}

const generateGuestName = () => `Guest${Math.floor(10000 + Math.random() * 90000)}`;

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            userName: generateGuestName(),
            user: null,
            setUserName: (name) => set({ userName: name }),
            setUser: (user) => set((state) => ({
                user,
                // If logging out, revert to guest. If logging in, use email prefix or existing metadata username
                userName: user
                    ? (user.user_metadata?.user_name || user.email?.split('@')[0] || state.userName)
                    : generateGuestName()
            })),
            logout: async () => {
                await supabase.auth.signOut();
                set({ user: null, userName: generateGuestName() });
            }
        }),
        {
            name: 'user-storage',
            partialize: (state) => ({ userName: state.userName }), // Only persist userName for guests
            onRehydrateStorage: () => (state) => {
                if (state && !state.userName) {
                    state.setUserName(generateGuestName());
                }
            },
        }
    )
);

// Initialize auth listener outside the store to sync state on load / auth changes
supabase.auth.onAuthStateChange((_event, session) => {
    useUserStore.getState().setUser(session?.user || null);
});
