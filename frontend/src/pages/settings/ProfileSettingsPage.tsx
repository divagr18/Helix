// src/pages/settings/ProfileSettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Github, Unlink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const profileFormSchema = z.object({
    username: z.string().min(2, { message: "Username must be at least 2 characters." }),
    // Add other fields if you want them to be editable
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const ProfileSettingsPage = () => {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [githubStatus, setGithubStatus] = useState<any>(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { username: '' },
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userResponse = await axios.get('/api/v1/users/me/');
                setUser(userResponse.data);
                form.reset(userResponse.data);

                // Try to fetch GitHub status, but don't fail if it errors
                try {
                    const githubResponse = await axios.get('/api/v1/users/github/status/');
                    setGithubStatus(githubResponse.data);
                } catch (githubError) {
                    console.error('Failed to fetch GitHub status:', githubError);
                    setGithubStatus({ connected: false });
                }

                setIsLoading(false);
            } catch (error) {
                console.error('Failed to load user data:', error);
                toast.error("Failed to load your profile data.");
                setIsLoading(false);
            }
        };

        fetchData();
    }, [form]);

    const onSubmit = async (data: ProfileFormValues) => {
        toast.info("Saving changes...");
        try {
            const response = await axios.patch('/api/v1/users/me/', data);
            form.reset(response.data);
            toast.success("Profile updated successfully.");
        } catch (error) {
            toast.error("Failed to update profile.", { description: String(error) });
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        toast.info("Deleting your account...");
        try {
            await axios.delete('/api/v1/users/me/');
            toast.success("Account deleted. You will be logged out.");
            // Force a reload to trigger logout and redirect
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            toast.error("Failed to delete account.", { description: String(error) });
            setIsDeleting(false);
        }
    };

    const handleConnectGithub = () => {
        // Redirect to GitHub OAuth connection
        window.location.href = '/accounts/github/login/?process=connect';
    };

    const handleDisconnectGithub = async () => {
        if (!user?.has_usable_password) {
            toast.error("You must set a password before disconnecting GitHub to maintain account access.");
            return;
        }

        setIsDisconnecting(true);
        try {
            await axios.post('/api/v1/users/github/disconnect/');
            toast.success("GitHub account disconnected successfully.");

            // Refresh GitHub status
            const githubResponse = await axios.get('/api/v1/users/github/status/');
            setGithubStatus(githubResponse.data);

            // Refresh user data
            const userResponse = await axios.get('/api/v1/users/me/');
            setUser(userResponse.data);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to disconnect GitHub account.");
        } finally {
            setIsDisconnecting(false);
        }
    };

    if (isLoading) {
        return <div>Loading profile...</div>;
    }

    console.log('Rendering ProfileSettingsPage', { user, githubStatus });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Profile Settings</h2>
                <p className="text-muted-foreground">Manage your personal account details.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Your Profile</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Username</FormLabel>
                                        <FormControl><Input placeholder="Your username" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl><Input readOnly disabled value={user?.email || ''} /></FormControl>
                            </FormItem>
                            <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Connected Accounts</CardTitle>
                    <CardDescription>Manage your connected accounts and authentication methods.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                            <Github className="h-6 w-6" />
                            <div>
                                <div className="font-medium flex items-center gap-2">
                                    GitHub
                                    {githubStatus?.connected && (
                                        <Badge variant="secondary" className="text-xs">Connected</Badge>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {githubStatus?.connected ? (
                                        <span>Connected as @{githubStatus.github_username}</span>
                                    ) : (
                                        <span>Connect your GitHub account to import repositories</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            {githubStatus?.connected ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!user?.has_usable_password}
                                        >
                                            <Unlink className="mr-2 h-4 w-4" />
                                            Disconnect
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will remove your GitHub connection. You'll need to reconnect to import repositories from GitHub.
                                                {!user?.has_usable_password && (
                                                    <span className="block mt-2 text-destructive">
                                                        You must set a password first to maintain account access.
                                                    </span>
                                                )}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDisconnectGithub}
                                                disabled={isDisconnecting || !user?.has_usable_password}
                                            >
                                                {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Disconnect
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleConnectGithub}
                                >
                                    <Github className="mr-2 h-4 w-4" />
                                    Connect GitHub
                                </Button>
                            )}
                        </div>
                    </div>

                    {!user?.has_usable_password && githubStatus?.connected && (
                        <div className="p-4 border border-yellow-500 rounded-lg bg-yellow-50 dark:bg-yellow-950 text-sm">
                            <strong>Note:</strong> You logged in with GitHub and haven't set a password yet.
                            Set a password before disconnecting GitHub to ensure you can still access your account.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-semibold">Delete Account</h3>
                            <p className="text-sm text-muted-foreground">Permanently delete your account and all of its data.</p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">Delete Account</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete your account, all of your workspaces, repositories,
                                        and associated data. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Yes, delete my account
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};