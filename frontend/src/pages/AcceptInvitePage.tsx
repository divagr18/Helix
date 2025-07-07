// src/pages/AcceptInvitePage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext'; // Import our new hook
import { Button } from '@/components/ui/button';
import { getCookie } from '@/utils';

export const AcceptInvitePage = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { addWorkspace, setActiveWorkspace } = useWorkspaceStore();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const [message, setMessage] = useState("Processing your invitation...");

    useEffect(() => {
        // Wait until we're done checking the auth status
        if (isAuthLoading) {
            return;
        }

        // If the user is not logged in, redirect them to the login page.
        // Pass the current path as the 'next' URL so they come back here after logging in.
        if (!isAuthenticated) {
            navigate(`/login?next=${location.pathname}`);
            return;
        }

        // If the user is authenticated, proceed to accept the invite
        axios.post(
            `/api/v1/invites/accept/${token}/`,
            {},
            {
                withCredentials: true,
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                },
            }
        )
            .then(response => {
                const joinedOrg = response.data;
                toast.success(`You have successfully joined the '${joinedOrg.name}' workspace!`);

                // Update the global state with the new workspace and set it as active
                addWorkspace(joinedOrg);
                setActiveWorkspace(joinedOrg);

                // Redirect to the dashboard, which will now show the new workspace's repos
                navigate('/dashboard');
            })
            .catch(err => {
                const errorMessage = err.response?.data?.error || "This invitation is invalid or has expired.";
                setMessage(`Error: ${errorMessage}`);
                toast.error("Could not accept invitation.", { description: errorMessage });
            });
    }, [token, navigate, addWorkspace, setActiveWorkspace, isAuthenticated, isAuthLoading, location.pathname]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
            <div className="p-8 border rounded-lg shadow-lg bg-card">
                <h1 className="text-2xl font-bold mb-4 text-center">Accepting Invitation</h1>
                <p className="text-muted-foreground text-center">{message}</p>
                {message.startsWith("Error:") && (
                    <div className="mt-6 text-center">
                        <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
                    </div>
                )}
            </div>
        </div>
    );
};