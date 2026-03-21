import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from './useUserStore';

export const usePresence = () => {
    const [onlineCount, setOnlineCount] = useState(1);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const userName = useUserStore((state) => state.userName);

    useEffect(() => {
        const channel = supabase.channel('platform-presence', {
            config: {
                presence: {
                    key: userName,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                
                // Convert presence state object to a flat list of users
                // In Supabase, state is { [key: string]: [{ presence_ref: string, ...userData }] }
                const users = Object.entries(state).map(([key, presences]: [string, any]) => ({
                    key: key,
                    ...presences[0] // Take the first presence instance for this key (username)
                }));
                
                setOnlineUsers(users);
                setOnlineCount(users.length > 0 ? users.length : 1);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        userName: userName,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            channel.unsubscribe();
        };
    }, [userName]);

    return { onlineCount, onlineUsers };
};
