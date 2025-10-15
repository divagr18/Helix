// src/components/layout/GlobalHeader.tsx
import React from 'react';
import { RepoSelector } from './RepoSelector';
import { ChevronRight, LogOut, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
// We'll need a workspace selector component as well, but let's use a placeholder for now.

export const GlobalHeader = () => {
    // Placeholder for workspace name
    const activeWorkspaceName = "My Workspace";
    const { user, logout } = useAuth(); // Get user and logout from AuthContext
    const navigate = useNavigate();

    const handleLogout = () => {
        logout(); // Call the logout function from your context
        navigate('/login'); // Redirect to login page
    };

    return (
        <header className="h-16 flex items-center px-6 border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-2 text-lg font-bold font-plex-sans">
                {/* Logo placeholder */}
                <p>Helix</p>
            </div>
            <div className="flex items-center ml-6">
                {/* Workspace Selector Placeholder */}
                <span className="font-medium font-plex-sans">{activeWorkspaceName}</span>
                <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground font-plex-sans" />
                <RepoSelector />
            </div>
            <div className="ml-auto">
                {/* User Profile Dropdown will go here */}
            </div>
            <div className="ml-auto">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center justify-center rounded-full h-9 w-9 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user?.avatar_url} alt={user?.username} />
                                <AvatarFallback>{user?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            <p className="font-semibold">{user?.username}</p>
                            <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => navigate('/settings/profile')}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
};