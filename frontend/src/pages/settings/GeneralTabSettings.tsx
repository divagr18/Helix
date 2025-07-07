// src/pages/settings/GeneralSettingsTab.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { toast } from 'sonner';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Define the form schema and type for renaming the workspace
const workspaceFormSchema = z.object({
    name: z.string().min(3, { message: "Workspace name must be at least 3 characters." }),
});

type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

export const GeneralSettingsTab = () => {
    // Get all necessary state and actions from our global workspace store
    const { activeWorkspace, setActiveWorkspace, setWorkspaces, workspaces } = useWorkspaceStore();
    const navigate = useNavigate();
    const [isDeleting, setIsDeleting] = useState(false);

    // Initialize react-hook-form
    const form = useForm<WorkspaceFormValues>({
        resolver: zodResolver(workspaceFormSchema),
        // Set default values to prevent uncontrolled component warnings
        defaultValues: {
            name: activeWorkspace?.name || '',
        },
    });

    // Effect to reset the form whenever the active workspace changes
    useEffect(() => {
        if (activeWorkspace) {
            form.reset({ name: activeWorkspace.name });
        }
    }, [activeWorkspace, form]);

    // Handler for the rename form submission
    const onRenameSubmit = async (data: WorkspaceFormValues) => {
        if (!activeWorkspace) return;

        toast.info("Renaming workspace...");
        try {
            const response = await axios.patch(`/api/v1/organizations/${activeWorkspace.id}/`, data);
            const updatedWorkspace = response.data;

            // Update the global state so the change is reflected everywhere
            setActiveWorkspace(updatedWorkspace);
            setWorkspaces(workspaces.map(ws => ws.id === updatedWorkspace.id ? updatedWorkspace : ws));

            toast.success("Workspace renamed successfully.");
            form.reset(updatedWorkspace); // Reset form with new data to clear the "dirty" state
        } catch (error: any) {
            toast.error("Failed to rename workspace.", { description: error.response?.data?.error || String(error) });
        }
    };

    // Handler for the delete button action
    const handleDeleteWorkspace = async () => {
        if (!activeWorkspace) return;

        setIsDeleting(true);
        toast.info("Deleting workspace and all its data...");
        try {
            await axios.delete(`/api/v1/organizations/${activeWorkspace.id}/`);

            // Update global state by removing the deleted workspace
            const remainingWorkspaces = workspaces.filter(ws => ws.id !== activeWorkspace.id);
            setWorkspaces(remainingWorkspaces);

            // Set a new active workspace (the first in the list) or null if none are left
            const newActiveWorkspace = remainingWorkspaces.length > 0 ? remainingWorkspaces[0] : null;
            setActiveWorkspace(newActiveWorkspace);

            toast.success(`Workspace '${activeWorkspace.name}' deleted successfully.`);
            // Navigate to the dashboard, as the settings for this workspace no longer exist
            navigate('/dashboard');
        } catch (error: any) {
            toast.error("Failed to delete workspace.", { description: error.response?.data?.error || String(error) });
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Update your workspace's name.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onRenameSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Workspace Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Your workspace name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                    <CardDescription>
                        Deleting your workspace is a permanent action and will remove all of its repositories and associated data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Delete this Workspace</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete the <strong>{activeWorkspace?.name}</strong> workspace
                                    and all of its repositories. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteWorkspace}
                                    disabled={isDeleting}
                                    className="bg-destructive hover:bg-destructive/90"
                                >
                                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Yes, delete this workspace
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
};