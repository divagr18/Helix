// src/stores/chatStore.ts
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid'; // For generating unique message IDs

// A unique ID is crucial for React's list rendering (the `key` prop)
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'error';
    content: string;
}

interface ChatState {
    isOpen: boolean;
    activeFilePath: string | null;
    messages: ChatMessage[];
    isLoading: boolean;
    activeRepoId: number | null; // To know which repo to query against
    openChat: (repoId: number) => void;
    closeChat: () => void;
    addMessage: (message: Omit<ChatMessage, 'id'>) => void;
    updateLastMessage: (chunk: string) => void;
    replaceLastMessage: (message: Omit<ChatMessage, 'id'>) => void;
    setIsLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    isOpen: false,
    messages: [],
    isLoading: false,
    activeRepoId: null,
    activeFilePath: null,

    /**
     * Opens the chat modal and sets the context for the current repository.
     */
    openChat: (repoId: number, filePath?: string) => set({
        isOpen: true,
        messages: [], // Clear previous conversation
        isLoading: false,
        activeRepoId: repoId,
        activeFilePath: filePath || null
    }),

    /**
     * Closes the chat modal.
     */
    closeChat: () => set({ isOpen: false, activeRepoId: null }),

    /**
     * Adds a new message to the conversation.
     */
    addMessage: (message) => {
        const newMessage = { ...message, id: uuidv4() };
        set((state) => ({ messages: [...state.messages, newMessage] }));
    },

    /**
     * Appends a chunk of text to the last message in the list.
     * Used for streaming AI responses.
     */
    updateLastMessage: (chunk) => {
        const currentMessages = get().messages;
        if (currentMessages.length === 0) return;

        const lastMessage = currentMessages[currentMessages.length - 1];
        // Ensure we are only updating an assistant's message
        if (lastMessage.role === 'assistant') {
            const updatedMessage = {
                ...lastMessage,
                content: lastMessage.content + chunk,
            };
            // Replace the last message with the updated one
            set({ messages: [...currentMessages.slice(0, -1), updatedMessage] });
        }
    },

    /**
     * Replaces the content and role of the last message.
     * Useful for turning a loading message into an error message.
     */
    replaceLastMessage: (message) => {
        const currentMessages = get().messages;
        if (currentMessages.length === 0) return;

        const newMessage = { ...message, id: uuidv4() };
        set({ messages: [...currentMessages.slice(0, -1), newMessage] });
    },

    /**
     * Sets the loading state.
     */
    setIsLoading: (loading) => set({ isLoading: loading }),
}));