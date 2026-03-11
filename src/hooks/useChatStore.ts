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
  isOpen: boolean;
  isSubscribed: boolean;
  setIsOpen: (isOpen: boolean) => void;
  toggleChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  fetchMessages: () => Promise<void>;
  subscribeToMessages: () => (() => void) | void;
  unsubscribe: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  isSubscribed: false,

  setIsOpen: (isOpen) => set({ isOpen }),
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

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
    if (!content.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{ user_name: userName, content: content.trim() }]);

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
