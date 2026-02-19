import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
    userName: string;
    setUserName: (name: string) => void;
}

const generateGuestName = () => `Guest${Math.floor(10000 + Math.random() * 90000)}`;

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            userName: generateGuestName(),
            setUserName: (name) => set({ userName: name }),
        }),
        {
            name: 'user-storage',
            onRehydrateStorage: () => (state) => {
                if (state && state.userName === 'Guest') {
                    state.setUserName(generateGuestName());
                }
            },
        }
    )
);
