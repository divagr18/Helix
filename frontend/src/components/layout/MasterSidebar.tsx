"use client"
import { NavLink, useLocation } from "react-router-dom"
import { useSidebarStore } from "@/stores/sidebarStore"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Code, BrainCircuit, TestTube, MessageSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useWorkspaceStore } from "@/stores/workspaceStore"

const navItems = [
    { mode: "code", icon: Code, label: "Code" },
    { mode: "intelligence", icon: BrainCircuit, label: "Intelligence" },
    { mode: "testing", icon: TestTube, label: "Testing" },
    { mode: "chat", icon: MessageSquare, label: "Chat" },
]

export const MasterSidebar = () => {
    const { isOpen, toggleSidebar } = useSidebarStore()
    const { activeRepository } = useWorkspaceStore()
    const location = useLocation()

    // This helper function correctly determines if a mode is active
    // by checking if the current URL path starts with the mode's base path.
    const isModeActive = (mode: string) => {
        if (!activeRepository) return false
        const basePath = `/repository/${activeRepository.id}/${mode}`
        return location.pathname.startsWith(basePath)
    }

    return (
        <nav
            className={cn(
                "h-full bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out",
                isOpen ? "w-56" : "w-16",
            )}
        >
            <div className="flex-grow p-2 pt-4 space-y-2">
                {navItems.map((item) => {
                    // --- THIS IS THE FIX ---
                    // The destination URL is now built dynamically inside the loop.
                    // If a repository is active, it creates the full path.
                    // If not, it defaults to the dashboard, and the link will be disabled.
                    const destination = activeRepository ? `/repository/${activeRepository.id}/${item.mode}` : "/dashboard"

                    const isActive = isModeActive(item.mode)

                    return (
                        <TooltipProvider key={item.mode} delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <NavLink
                                        to={destination}
                                        // Prevent navigation if no repository is active
                                        onClick={(e) => {
                                            if (!activeRepository) e.preventDefault()
                                        }}
                                        className={cn(
                                            "flex items-center p-3 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
                                            "transition-colors duration-200",
                                            isActive && "text-blue-400 hover:bg-zinc-800/70", // Updated active style
                                            !activeRepository && "cursor-not-allowed opacity-50", // Visually disable the link
                                        )}
                                    >
                                        <item.icon className="h-5 w-5 flex-shrink-0" />
                                        <span
                                            className={cn(
                                                "ml-4 font-medium whitespace-nowrap transition-opacity duration-200",
                                                isOpen ? "opacity-100" : "opacity-0",
                                            )}
                                        >
                                            {item.label}
                                        </span>
                                    </NavLink>
                                </TooltipTrigger>
                                {!isOpen && (
                                    <TooltipContent side="right">
                                        <p>{item.label}</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    )
                })}
            </div>
            {/* The collapse button at the bottom */}
            <div className="p-2 border-t border-border">
                <Button variant="ghost" onClick={toggleSidebar} className="w-full flex items-center justify-start p-3">
                    {isOpen ? (
                        <PanelLeftClose className="h-5 w-5 flex-shrink-0" />
                    ) : (
                        <PanelLeftOpen className="h-5 w-5 flex-shrink-0" />
                    )}
                    <span
                        className={cn(
                            "ml-4 font-medium whitespace-nowrap transition-opacity duration-200",
                            isOpen ? "opacity-100" : "opacity-0",
                        )}
                    >
                        Collapse
                    </span>
                </Button>
            </div>
        </nav>
    )
}
