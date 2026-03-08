import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from './useUserStore';

export const usePresence = () => {
    const [onlineCount, setOnlineCount] = useState(1);
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
                const count = Object.keys(state).length;
                setOnlineCount(count > 0 ? count : 1);
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

    return { onlineCount };
};
