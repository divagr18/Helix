// src/pages/ForgotPasswordPage.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

export function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        const form = event.currentTarget;
        const username = (form.elements.namedItem('username') as HTMLInputElement).value;

        try {
            await axios.post('/api/v1/auth/password-reset/request/', {
                username,
            });

            setEmailSent(true);
            toast.success('Reset link sent!', {
                description: 'Check your email for password reset instructions.',
            });
        } catch (error: any) {
            const errorMessage = error.response?.data?.error ||
                'An error occurred while sending the reset email.';
            toast.error('Reset Failed', {
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (emailSent) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background px-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                            <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <CardTitle className="text-2xl">Check your email</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            We've sent password reset instructions to the email address associated with your account.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-center">
                        <Button asChild variant="outline">
                            <Link to="/login" className="flex items-center space-x-2">
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to login</span>
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-xl font-bold text-primary">H</span>
                    </div>
                    <CardTitle className="text-2xl">Forgot your password?</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Enter your username and we'll send a reset link to your email address.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                name="username"
                                type="text"
                                required
                                placeholder="johndoe"
                                className="mt-1"
                                disabled={isLoading}
                            />
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending reset link...
                                </>
                            ) : (
                                'Send reset link'
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex justify-center">
                    <Button asChild variant="link">
                        <Link to="/login" className="flex items-center space-x-2">
                            <ArrowLeft className="h-4 w-4" />
                            <span>Back to login</span>
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
