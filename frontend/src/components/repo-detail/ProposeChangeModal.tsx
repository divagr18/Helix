// src/components/repo-detail/ProposeChangeModal.tsx
import React, { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ProposeChangeModalProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    originalCode: string;
    modifiedCode: string;
    language: string;
    onSubmit: (commitMessage: string) => void;
    isSubmitting: boolean;
}

export const ProposeChangeModal: React.FC<ProposeChangeModalProps> = ({
    isOpen,
    onOpenChange,
    originalCode,
    modifiedCode,
    language,
    onSubmit,
    isSubmitting,
}) => {
    const [commitMessage, setCommitMessage] = useState('');

    const handleSubmit = () => {
        if (commitMessage.trim()) {
            onSubmit(commitMessage);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Propose a Change</DialogTitle>
                    <DialogDescription>
                        Review your changes below. A new branch will be created and a Pull Request will be opened on GitHub.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-grow border rounded-md overflow-hidden my-4">
                    <DiffEditor
                        height="100%"
                        original={originalCode}
                        modified={modifiedCode}
                        language={language}
                        theme="vs-dark"
                        options={{ readOnly: true, renderSideBySide: true }}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="commit-message">Commit Message</Label>
                    <Input
                        id="commit-message"
                        placeholder="e.g., Refactor: Simplify data processing logic"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        disabled={isSubmitting}
                    />
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!commitMessage.trim() || isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Pull Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};