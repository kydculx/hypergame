import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useUserStore } from './useUserStore';

export interface ChatMessage {
  id: string;
  user_name: string;
  content: string;
  created_at: string;
}

interface ChatState {
  messages: ChatMessage[];
  isSubscribed: boolean;
  sendMessage: (content: string) => Promise<void>;
  fetchMessages: () => Promise<void>;
  subscribeToMessages: () => (() => void) | void;
  unsubscribe: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isSubscribed: false,

  fetchMessages: async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) set({ messages: data.reverse() });
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    }
  },

  sendMessage: async (content: string) => {
    const { userName } = useUserStore.getState();
    const trimmedContent = content.trim().substring(0, 50);
    if (!trimmedContent) return;
    
    try {
      const { error } = await supabase
        .from('messages')
        .insert([{ user_name: userName, content: trimmedContent }]);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error sending message:', err);
    }
  },

  subscribeToMessages: () => {
    if (get().isSubscribed) return;

    const subscription = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new as ChatMessage;
        set((state) => ({
          messages: [...state.messages.slice(-49), newMessage]
        }));
      })
      .subscribe();

    set({ isSubscribed: true });

    return () => {
      subscription.unsubscribe();
      set({ isSubscribed: false });
    };
  },

  unsubscribe: () => {
    supabase.channel('public:messages').unsubscribe();
    set({ isSubscribed: false });
  }
}));
