// src/components/Header.tsx
import React from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ChevronsUpDown, PlusCircle, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth hook

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from 'react-router-dom';

export const Header = () => {
    const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspaceStore();
    const { logout } = useAuth();
    const handleLogout = async () => {
        // You can add a toast message here if you want
        // toast.info("Logging you out...");
        await logout();
    };
    return (
        <header className="flex items-center justify-between p-4 md:p-6 border-b border-border h-20">
            <div className="flex items-center gap-4">
                {/* Workspace Switcher */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-[200px] justify-between">
                            <span className="truncate font-semibold">{activeWorkspace?.name || "No Workspace"}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[200px]" align="start">
                        <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {workspaces.map(ws => (
                            <DropdownMenuItem key={ws.id} onSelect={() => setActiveWorkspace(ws)}>
                                {ws.name}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => { /* TODO: Open 'Create Workspace' modal */ }}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            <span>Create Workspace</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* User Profile / Settings Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 rounded-full">
                        {/* Placeholder for user avatar */}
                        <User className="h-5 w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <Link to="/settings/account"><DropdownMenuItem>Account Settings</DropdownMenuItem></Link>
                    <Link to="/settings/workspace"><DropdownMenuItem>Workspace Settings</DropdownMenuItem></Link>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                        Log out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
};