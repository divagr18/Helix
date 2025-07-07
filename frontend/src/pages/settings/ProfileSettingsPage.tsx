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
import { Loader2 } from 'lucide-react';

const profileFormSchema = z.object({
    username: z.string().min(2, { message: "Username must be at least 2 characters." }),
    // Add other fields if you want them to be editable
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const ProfileSettingsPage = () => {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { username: '' },
    });

    useEffect(() => {
        axios.get('/api/v1/users/me/')
            .then(response => {
                setUser(response.data);
                form.reset(response.data);
                setIsLoading(false);
            })
            .catch(() => {
                toast.error("Failed to load your profile data.");
                setIsLoading(false);
            });
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

    if (isLoading) {
        return <div>Loading profile...</div>;
    }

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