import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chatStore';
import { useParams } from 'react-router-dom';

/**
 * Sleek, professional floating chat button for code view page.
 * Opens the chat modal when clicked.
 */
export const ChatButton = () => {
    const { openChat } = useChatStore();
    const { repoId } = useParams();

    const handleOpenChat = () => {
        if (repoId) {
            openChat(parseInt(repoId));
        }
    };

    return (
        <Button
            onClick={handleOpenChat}
            className="fixed bottom-6 right-6 z-40 h-auto px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-100 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg border border-gray-700 hover:border-gray-600 group"
        >
            <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Ask Helix</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-gray-900 rounded text-[10px] font-mono border border-gray-700">Ctrl</kbd>
                        <span>+</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-900 rounded text-[10px] font-mono border border-gray-700">K</kbd>
                    </span>
                </div>
            </div>
        </Button>
    );
};
