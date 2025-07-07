// src/pages/settings/SettingsLayout.tsx
import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { User, Building, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const settingsNavLinks = [
    { to: '/settings/profile', label: 'Profile', icon: User },
    { to: '/settings/workspace', label: 'Workspace', icon: Building },
    // Add more top-level settings categories here later (e.g., Billing)
];

export const SettingsLayout = () => {
    return (
        <div className="container mx-auto max-w-6xl py-8">
            <div className="mb-8 flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <Link to="/dashboard">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

                {/* Left Pane: Navigation Sidebar */}
                <aside className="md:col-span-1">
                    <nav className="flex flex-col space-y-1">
                        {settingsNavLinks.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                // --- THIS IS THE FIX ---
                                // We provide a more explicit style for the active state.
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                        isActive
                                            ? 'bg-primary text-primary-foreground' // Active state: primary color background
                                            : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground' // Inactive state
                                    )
                                }
                                // Add `end` prop to NavLink for more precise matching
                                end={link.to === '/settings/workspace'}
                            >
                                <link.icon className="mr-3 h-5 w-5" />
                                <span>{link.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                {/* Right Pane: Content Area */}
                <main className="md:col-span-3">
                    <Outlet /> {/* Child routes will be rendered here */}
                </main>

            </div>
        </div>
    );
};