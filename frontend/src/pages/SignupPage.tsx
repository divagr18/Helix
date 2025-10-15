// src/pages/SignupPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { Separator } from '@/components/ui/separator';
import { Github as GithubIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function SignupPage() {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    // GitHub OAuth URL for signup
    const GITHUB_LOGIN_URL = '/accounts/github/login/';

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        const form = event.currentTarget;
        const username = (form.elements.namedItem('username') as HTMLInputElement).value;
        const email = (form.elements.namedItem('email') as HTMLInputElement).value;
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

        try {
            await axios.post('/api/v1/auth/signup/', {
                username,
                email: email || '', // Send empty string if no email provided
                password,
            });

            toast.success('Account created successfully!', {
                description: 'You can now sign in with your credentials.',
            });

            // Clear the form and redirect to login
            form.reset();
            navigate('/login');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error ||
                error.response?.data?.username?.[0] ||
                error.response?.data?.email?.[0] ||
                error.response?.data?.password?.[0] ||
                'An error occurred during signup.';
            toast.error('Signup Failed', {
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGitHubSignup = () => {
        // Redirect to GitHub OAuth for signup
        window.location.href = GITHUB_LOGIN_URL;
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-xl font-bold text-primary">H</span>
                    </div>
                    <CardTitle className="text-2xl">Create your Helix account</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Get started with intelligent code analysis and documentation
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* OAuth */}
                    <Button
                        onClick={handleGitHubSignup}
                        size="lg"
                        className="w-full flex items-center justify-center space-x-2"
                        variant="outline"
                        disabled={isLoading}
                    >
                        <GithubIcon className="h-5 w-5" />
                        <span>Continue with GitHub</span>
                    </Button>

                    {/* Privacy disclaimer */}
                    <div className="text-center text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                        <p className="font-medium mb-1">🔒 Your Privacy Matters</p>
                        <p>
                            Helix stores no data from your GitHub account or code.
                            Your repositories remain private.
                        </p>
                    </div>

                    <div className="relative">
                        <Separator />
                        <span className="absolute inset-x-0 mx-auto w-max bg-background px-2 text-sm text-muted-foreground">
                            or
                        </span>
                    </div>

                    {/* Email / Password Form */}
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
                        <div>
                            <Label htmlFor="email">Email address (optional)</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="you@example.com"
                                className="mt-1"
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <Label htmlFor="password">Password</Label>
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
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
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
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Account
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex justify-center">
                    <span className="text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/login" className="font-medium text-primary hover:underline">
                            Sign in
                        </Link>
                    </span>
                </CardFooter>
            </Card>
        </div>
    );
}
