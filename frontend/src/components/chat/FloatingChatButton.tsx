import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chatStore';
import { useParams, useLocation } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect, useState } from 'react';

/**
 * Floating chat button that appears on repository pages.
 * Clicking it opens the chat dialog, or use Ctrl+K keyboard shortcut.
 */
export const FloatingChatButton = () => {
    const { repoId } = useParams();
    const location = useLocation();
    const { openChat } = useChatStore();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Only show the button on repository pages
        const isRepoPage = location.pathname.includes('/repository/');
        setIsVisible(isRepoPage && !!repoId);
    }, [location.pathname, repoId]);

    if (!isVisible) return null;

    const handleClick = () => {
        if (repoId) {
            openChat(parseInt(repoId));
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={handleClick}
                        size="icon"
                        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-50 transition-all hover:scale-110"
                    >
                        <MessageSquare className="h-6 w-6" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="flex flex-col gap-1">
                    <p>Chat with Helix</p>
                    <p className="text-xs text-gray-400">
                        or press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-xs">Ctrl+K</kbd>
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
