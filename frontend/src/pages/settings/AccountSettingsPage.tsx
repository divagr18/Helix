// src/pages/settings/AccountSettingsPage.tsx
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
import { Link } from 'react-router-dom'; // Import Link from react-router-dom
import { ArrowLeft } from 'lucide-react';

// Define the shape of our form data and its validation rules
const profileFormSchema = z.object({
    username: z.string().min(2, { message: "Username must be at least 2 characters." }),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const AccountSettingsPage = () => {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { username: '', first_name: '', last_name: '' },
    });

    // Fetch user data on component mount
    useEffect(() => {
        axios.get('/api/v1/users/me/')
            .then(response => {
                setUser(response.data);
                form.reset(response.data); // Populate the form with fetched data
                setIsLoading(false);
            })
            .catch(err => {
                toast.error("Failed to load user data.");
                setIsLoading(false);
            });
    }, [form]);

    const onSubmit = async (data: ProfileFormValues) => {
        toast.info("Saving changes...");
        try {
            const response = await axios.patch('/api/v1/users/me/', data);
            form.reset(response.data); // Reset form with new data to prevent "dirty" state
            toast.success("Profile updated successfully.");
        } catch (error) {
            toast.error("Failed to update profile.", { description: String(error) });
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        toast.info("Deleting your account and all data...");
        try {
            await axios.delete('/api/v1/users/me/');
            // On success, the backend deletes the user and their session becomes invalid.
            // We can force a page reload to redirect them to the login page.
            window.location.href = '/';
        } catch (error) {
            toast.error("Failed to delete account.", { description: String(error) });
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return <div>Loading account settings...</div>;
    }

    return (
        <div className="container mx-auto max-w-3xl py-8">

            <h1 className="text-2xl font-bold mb-4">Account Settings</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Update your personal information.</CardDescription>
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
                            {/* Email is read-only */}
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl><Input readOnly disabled value={user?.email || ''} /></FormControl>
                            </FormItem>
                            <Button type="submit" disabled={!form.formState.isDirty}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card className="mt-8 border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Delete My Account</Button>
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
                </CardContent>
            </Card>
        </div>
    );
};