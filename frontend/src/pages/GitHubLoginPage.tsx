// src/pages/GitHubLoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Github as GithubIcon, Loader2, ArrowLeft } from 'lucide-react';

export function GitHubLoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    // GitHub OAuth URL - must be full URL to backend
    const GITHUB_LOGIN_URL =
        (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/accounts/github/login/';

    const handleGitHubLogin = () => {
        setIsLoading(true);
        // Redirect to GitHub OAuth
        window.location.href = GITHUB_LOGIN_URL;
    };

    const handleBackToLogin = () => {
        navigate('/login');
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    {/* Logo placeholder */}
                    <div className="mx-auto mb-4 h-12 w-12">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="currentColor"
                            className="h-full w-full text-primary"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path d="M12 2C8 2 4 6 4 10s4 8 8 8 8-4 8-8-4-8-8-8zm0 14a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
                        </svg>
                    </div>
                    <CardTitle className="text-2xl">Continue with GitHub</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Sign in to Helix CME with your GitHub account to access your repositories and start analyzing your code.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* GitHub Login Button */}
                    <Button
                        onClick={handleGitHubLogin}
                        size="lg"
                        className="w-full flex items-center justify-center space-x-3 bg-[#24292f] hover:bg-[#1c2128] text-white border-0"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <GithubIcon className="h-5 w-5" />
                        )}
                        <span className="font-medium">
                            {isLoading ? 'Redirecting to GitHub...' : 'Sign in with GitHub'}
                        </span>
                    </Button>

                    {/* Additional Information */}
                    <div className="text-center text-sm text-muted-foreground space-y-2">
                        <p>
                            By signing in, you agree to our Terms of Service and Privacy Policy.
                        </p>
                        <p>
                            We'll only access your public repositories and basic profile information.
                        </p>
                    </div>

                    {/* Back to Login */}
                    <Button
                        variant="ghost"
                        onClick={handleBackToLogin}
                        className="w-full flex items-center justify-center space-x-2"
                        disabled={isLoading}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to login options</span>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
