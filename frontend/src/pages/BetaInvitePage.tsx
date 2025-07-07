// src/pages/BetaInvitePage.tsx
import React, { useState } from 'react';
import api from '@/utils/api';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github as GithubIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function BetaInvitePage() {
    const [isLoading, setIsLoading] = useState(false);

    // NOTE: this MUST be the full path on your backend,
    // so that the browser follows the 302 → GitHub → callback flow.
    const GITHUB_LOGIN_URL =
        import.meta.env.VITE_API_BASE_URL! + '/accounts/github/login/';

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        const form = event.currentTarget;
        const code = (form.elements.namedItem('invite_code') as HTMLInputElement)
            .value;

        try {
            // 1️⃣ Validate the invite code on your backend.
            await api.post('/api/v1/invites/validate/', { code });

            // 2️⃣ Kick off the full-page OAuth redirect:
            window.location.href = GITHUB_LOGIN_URL;
        } catch (error: any) {
            toast.error('Validation Failed', {
                description: error.response?.data?.error || 'Unknown error.',
            });
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">
                        Welcome to the Helix CME Beta
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Please enter your invite code to continue.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="invite_code">Invite Code</Label>
                            <Input
                                id="invite_code"
                                name="invite_code"
                                type="text"
                                required
                                placeholder="Enter your invite code"
                                className="mt-1"
                            />
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            className="w-full flex items-center justify-center"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <GithubIcon className="mr-2 h-4 w-4" />
                            )}
                            Continue with GitHub
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
