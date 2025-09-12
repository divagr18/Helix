// ── LoginPage.tsx ──
import { Link, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Github as GithubIcon, Loader2 } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { checkAuth } = useAuth();

    // GitHub OAuth URL - must be full URL to backend
    const GITHUB_LOGIN_URL =
        (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/accounts/github/login/';

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        const form = event.currentTarget;
        const identifier = (form.elements.namedItem('email') as HTMLInputElement).value;
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;

        try {
            const response = await axios.post('/api/v1/auth/login/', {
                identifier,
                password,
            });

            toast.success('Login successful!');

            // Check auth status and redirect
            await checkAuth();
            navigate('/dashboard');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || 'Invalid credentials. Please try again.';
            toast.error('Login Failed', {
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    {/* Replace with your actual logo component or <img> */}
                    <div className="mx-auto mb-4 h-12 w-12">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="currentColor"
                            className="h-full w-full text-primary"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            {/* simple abstract helix icon */}
                            <path d="M12 2C8 2 4 6 4 10s4 8 8 8 8-4 8-8-4-8-8-8zm0 14a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
                        </svg>
                    </div>
                    <CardTitle className="text-2xl">Welcome to Helix CME</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Sign in to manage your enterprise workflows
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* OAuth */}
                    <Button
                        asChild
                        size="lg"
                        className="w-full flex items-center justify-center space-x-2"
                        variant="outline"
                    >
                        <a href={GITHUB_LOGIN_URL} aria-label="Continue with GitHub">
                            <GithubIcon className="h-5 w-5" />
                            <span>Continue with GitHub</span>
                        </a>
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
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <Label htmlFor="email">Email address or Username</Label>
                            <Input
                                id="email"
                                name="email"
                                type="text"
                                required
                                placeholder="you@company.com or username"
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
                            />
                            <a
                                href="/forgot-password"
                                className="mt-1 block text-sm text-primary hover:underline"
                            >
                                Forgot your password?
                            </a>
                        </div>
                        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing In...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex justify-center">
                    <span className="text-sm text-muted-foreground">
                        New to Helix CME?{" "}
                        <Link to="/signup" className="font-medium text-primary hover:underline">
                            Create an account
                        </Link>
                    </span>
                </CardFooter>
            </Card>
        </div>
    );
}
