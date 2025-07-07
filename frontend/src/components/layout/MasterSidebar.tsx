// src/components/layout/MasterSidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSidebarStore } from '@/stores/sidebarStore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Code, BrainCircuit, TestTube, MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const navItems = [
    { to: "/code", icon: Code, label: "Code" },
    { to: "/intelligence", icon: BrainCircuit, label: "Intelligence" },
    { to: "/testing", icon: TestTube, label: "Testing" },
    { to: "/chat", icon: MessageSquare, label: "Chat" },
];

export const MasterSidebar = () => {
    const { isOpen, toggleSidebar } = useSidebarStore();

    return (
        <nav className={cn(
            "h-full bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out",
            isOpen ? "w-56" : "w-16"
        )}>
            {/* Use flex-grow on the container for the nav items */}
            <div className="flex-grow p-2 pt-4 space-y-2">
                {navItems.map((item) => (
                    <TooltipProvider key={item.to} delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <NavLink
                                    to={item.to}
                                    className={({ isActive }) =>
                                        cn(
                                            "flex items-center pl-8 pr-3 py-2 rounded-md w-full", // ← changed from px-3 to pl-5 pr-3
                                            "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-200",
                                            isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
                                        )
                                    }
                                >
                                    <div className="flex items-center space-x-3 w-full overflow-hidden">
                                        <item.icon className="h-5 w-5 shrink-0" />
                                        <span
                                            className={cn(
                                                "text-sm font-medium whitespace-nowrap transition-opacity duration-200",
                                                isOpen ? "opacity-100" : "opacity-0"
                                            )}
                                        >
                                            {item.label}
                                        </span>
                                    </div>
                                </NavLink>

                            </TooltipTrigger>
                            {!isOpen && <TooltipContent side="right"><p>{item.label}</p></TooltipContent>}
                        </Tooltip>
                    </TooltipProvider>
                ))}
            </div>

            {/* The collapse button at the bottom */}
            <div className="p-2 border-t border-border">
                <Button
                    variant="ghost"
                    onClick={toggleSidebar}
                    className="w-full flex items-center pl-5 pr-3 py-2"
                >
                    <div className="flex items-center space-x-3 w-full overflow-hidden">
                        {isOpen ? (
                            <PanelLeftClose className="h-5 w-5 shrink-0" />
                        ) : (
                            <PanelLeftOpen className="h-5 w-5 shrink-0" />
                        )}
                        <span
                            className={cn(
                                "text-sm font-medium whitespace-nowrap transition-opacity duration-200",
                                isOpen ? "opacity-100" : "opacity-0"
                            )}
                        >
                            Collapse
                        </span>
                    </div>
                </Button>

            </div>
        </nav>
    );
};