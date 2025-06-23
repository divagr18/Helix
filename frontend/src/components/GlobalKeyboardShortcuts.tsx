// src/components/GlobalKeyboardShortcuts.tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChatStore } from '@/stores/chatStore';

export const GlobalKeyboardShortcuts = () => {
    const params = useParams<{ repoId?: string }>();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                
                const repoIdNum = params.repoId ? parseInt(params.repoId, 10) : null;
                
                // Log for debugging
                console.log("Cmd+K pressed. Current repoId param:", params.repoId);

                if (repoIdNum) {
                    console.log(`Opening chat for repoId: ${repoIdNum}`);
                    useChatStore.getState().openChat(repoIdNum);
                } else {
                    console.log("Not on a repository page, chat not opened.");
                }
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [params.repoId]); // The dependency array is key. It re-registers the listener if the page changes.

    // This component renders nothing to the DOM.
    return null;
};