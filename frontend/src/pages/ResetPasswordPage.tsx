// src/pages/ResetPasswordPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ResetPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        const form = event.currentTarget;
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;
        const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

        // Basic validation
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            setIsLoading(false);
            return;
        }

        if (password.length < 8) {
            toast.error('Password must be at least 8 characters long');
            setIsLoading(false);
            return;
        }

        if (!token) {
            toast.error('Invalid reset link');
            setIsLoading(false);
            return;
        }

        try {
            await axios.post('/api/v1/auth/password-reset/confirm/', {
                token,
                new_password: password,
            });

            toast.success('Password reset successfully!', {
                description: 'You can now sign in with your new password.',
            });

            // Redirect to login
            navigate('/login');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error ||
                'An error occurred while resetting your password.';
            toast.error('Reset Failed', {
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background px-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Invalid Reset Link</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            This password reset link is invalid or has expired.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-center">
                        <Button asChild variant="outline">
                            <Link to="/forgot-password">
                                Request a new reset link
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
                    <CardTitle className="text-2xl">Reset your password</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Enter your new password below.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="password">New Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                placeholder="••••••••"
                                className="mt-1"
                                disabled={isLoading}
                                minLength={8}
                            />
                        </div>
                        <div>
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                placeholder="••••••••"
                                className="mt-1"
                                disabled={isLoading}
                                minLength={8}
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
                                    Resetting password...
                                </>
                            ) : (
                                'Reset password'
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
