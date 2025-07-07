// ── LoginPage.tsx ──
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Github as GithubIcon } from "lucide-react";

export function LoginPage() {
    const GITHUB_LOGIN_URL = '/accounts/github/login/';

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

                    <div className="relative">
                        <Separator />
                        <span className="absolute inset-x-0 mx-auto w-max bg-background px-2 text-sm text-muted-foreground">
                            or
                        </span>
                    </div>

                    {/* Email / Password Form */}
                    <form className="space-y-4">
                        <div>
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                placeholder="you@company.com"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                placeholder="••••••••"
                                className="mt-1"
                            />
                            <a
                                href="/forgot-password"
                                className="mt-1 block text-sm text-primary hover:underline"
                            >
                                Forgot your password?
                            </a>
                        </div>
                        <Button type="submit" size="lg" className="w-full">
                            Sign In
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex justify-center">
                    <span className="text-sm text-muted-foreground">
                        New to Helix CME?{" "}
                        <a href="/signup" className="font-medium text-primary hover:underline">
                            Create an account
                        </a>
                    </span>
                </CardFooter>
            </Card>
        </div>
    );
}
