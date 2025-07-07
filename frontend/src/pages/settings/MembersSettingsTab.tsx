// src/pages/settings/MembersSettingsTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2 } from 'lucide-react';
import { type DetailedOrganization } from '@/types';

export const MembersSettingsTab = () => {
    const { activeWorkspace } = useWorkspaceStore();
    const [orgDetails, setOrgDetails] = useState<DetailedOrganization | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInviting, setIsInviting] = useState(false);

    const fetchOrgDetails = useCallback(() => {
        if (!activeWorkspace) return;
        setIsLoading(true);
        axios.get(`/api/v1/organizations/${activeWorkspace.id}/`)
            .then(res => setOrgDetails(res.data))
            .catch(() => toast.error("Failed to load workspace members."))
            .finally(() => setIsLoading(false));
    }, [activeWorkspace]);

    useEffect(fetchOrgDetails, [fetchOrgDetails]);

    const handleSendInvite = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!activeWorkspace) return;

        const form = event.currentTarget;
        const email = (form.elements.namedItem('email') as HTMLInputElement).value;
        const role = (form.elements.namedItem('role') as HTMLInputElement).value;

        setIsInviting(true);
        toast.info("Sending invitation...");
        try {
            await axios.post(`/api/v1/organizations/${activeWorkspace.id}/invites/`, { email, role });
            toast.success(`Invitation sent to ${email}.`);
            form.reset();
            fetchOrgDetails(); // Refresh the list of pending invites
        } catch (error: any) {
            toast.error("Failed to send invite.", { description: error.response?.data?.error || String(error) });
        } finally {
            setIsInviting(false);
        }
    };

    const handleRemoveMember = async (membershipId: number) => {
        if (!activeWorkspace) return;
        if (!window.confirm("Are you sure you want to remove this member?")) return;

        toast.info("Removing member...");
        try {
            await axios.delete(`/api/v1/organizations/${activeWorkspace.id}/members/${membershipId}/`);
            toast.success("Member removed successfully.");
            fetchOrgDetails(); // Refresh the member list
        } catch (error: any) {
            toast.error("Failed to remove member.", { description: error.response?.data?.error || String(error) });
        }
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (!orgDetails) return <p className="text-muted-foreground">Could not load workspace details.</p>;

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Invite New Member</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row gap-2">
                        <Input name="email" type="email" placeholder="name@example.com" required className="flex-grow" disabled={isInviting} />
                        <Select name="role" defaultValue="MEMBER" disabled={isInviting}>
                            <SelectTrigger className="w-full sm:w-[120px]">
                                <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="MEMBER">Member</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button type="submit" disabled={isInviting}>
                            {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Invite
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Workspace Members</CardTitle>
                    <CardDescription>Manage who has access to this workspace and its repositories.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orgDetails.memberships.map(member => (
                                <TableRow key={member.id}>
                                    <TableCell>
                                        <div className="font-medium">{member.user.username}</div>
                                        <div className="text-sm text-muted-foreground">{member.user.email}</div>
                                    </TableCell>
                                    <TableCell>{member.role}</TableCell>
                                    <TableCell className="text-right">
                                        {member.role !== 'OWNER' && (
                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {orgDetails.invitations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Invitations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* You can build a similar table for pending invitations here */}
                        {orgDetails.invitations.map(invite => (
                            <div key={invite.id} className="flex justify-between items-center p-2">
                                <span>{invite.email} ({invite.role})</span>
                                <Button variant="ghost" size="sm">Revoke</Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};