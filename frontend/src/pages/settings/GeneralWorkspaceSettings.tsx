// src/pages/settings/GeneralWorkspaceSettings.tsx
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const workspaceFormSchema = z.object({
  name: z.string().min(3, { message: "Workspace name must be at least 3 characters." }),
});

type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

export const GeneralWorkspaceSettings = () => {
  const { activeWorkspace, setActiveWorkspace, setWorkspaces, workspaces } = useWorkspaceStore();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: { name: activeWorkspace?.name || '' },
  });

  // When the active workspace changes, reset the form with the new name
  useEffect(() => {
    form.reset({ name: activeWorkspace?.name || '' });
  }, [activeWorkspace, form]);

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
      form.reset(updatedWorkspace); // Reset form to prevent "isDirty" from being true
    } catch (error: any) {
      toast.error("Failed to rename workspace.", { description: error.response?.data?.error || String(error) });
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) return;

    setIsDeleting(true);
    toast.info("Deleting workspace and all its data...");
    try {
      await axios.delete(`/api/v1/organizations/${activeWorkspace.id}/`);

      // Update global state by removing the deleted workspace
      const remainingWorkspaces = workspaces.filter(ws => ws.id !== activeWorkspace.id);
      setWorkspaces(remainingWorkspaces);

      // Set a new active workspace or null if none are left
      const newActiveWorkspace = remainingWorkspaces.length > 0 ? remainingWorkspaces[0] : null;
      setActiveWorkspace(newActiveWorkspace);

      toast.success("Workspace deleted successfully.");

      // If there are other workspaces, stay on the settings page. If not, go to dashboard.
      if (newActiveWorkspace) {
        // The page will re-render with the new active workspace context
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error("Failed to delete workspace.", { description: error.response?.data?.error || String(error) });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Name</CardTitle>
          <CardDescription>This is the name that will be displayed in the workspace switcher.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onRenameSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input placeholder="Your workspace name" {...field} className="max-w-sm" /></FormControl>
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
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <div>
              <h3 className="font-semibold">Delete this Workspace</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This will permanently delete the workspace, including all of its repositories and data.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-4 md:mt-0">Delete Workspace</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the <strong>{activeWorkspace?.name}</strong> workspace.
                    All repositories within it will be removed from Helix. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteWorkspace} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Yes, delete this workspace
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