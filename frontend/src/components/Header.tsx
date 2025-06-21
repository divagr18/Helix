// src/components/Header.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
// Import Lucide icons
import { Code2, Search, LogOut } from 'lucide-react'; // Replaced FaCode, FaSearch, FaSignOutAlt
import { NotificationsBell } from './NotificationBell'; // Assuming this is already styled or will be separately

// Import shadcn/ui components (adjust path if your alias is different)
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function Header() {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
            // setSearchTerm(''); // Optional: clear search term
        }
    };

    const handleLogout = async () => {
        try {
            await axios.post('http://localhost:8000/api/v1/auth/logout/', {}, {
                withCredentials: true
            });
            window.location.href = '/';
        } catch (error) {
            console.error("Logout failed:", error);
            alert("Logout failed. Please try again.");
        }
    };

    return (
        <header className="sticky top-0 z-50 flex h-[60px] items-center justify-between border-b border-border bg-card px-6 md:px-8">
            {/* Logo/Title Section */}
            <Link to="/dashboard" className="flex items-center text-foreground no-underline">
                <Code2 className="mr-2 h-7 w-7 text-primary" strokeWidth={2.5} /> {/* Lucide icon */}
                <h2 className="text-xl font-semibold tracking-tight">Helix CME</h2>
            </Link>

            {/* Search Bar Section - Centered */}
            <div className="flex-grow flex justify-center px-4"> {/* Added px-4 for spacing */}
                <form onSubmit={handleSearchSubmit} className="flex items-center w-full max-w-lg"> {/* max-w-lg for medium size */}
                    <Input // shadcn/ui Input
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Semantic code search..."
                        className="h-9 rounded-r-none border-r-0 focus-visible:ring-offset-0 focus-visible:ring-0" // Custom styling for joining with button
                        // focus-visible:ring-offset-0 and focus-visible:ring-0 to remove default focus ring if button has one
                    />
                    <Button // shadcn/ui Button
                        type="submit"
                        variant="default" // Will use your --primary color
                        size="icon" // Makes it square for an icon
                        className="h-9 w-9 rounded-l-none" // Remove left rounding to join with input
                        aria-label="Search"
                    >
                        <Search className="h-4 w-4" /> {/* Lucide icon */}
                    </Button>
                </form>
            </div>

            {/* User Actions Section (Notifications & Logout) */}
            <div className="flex items-center gap-3 md:gap-4"> {/* Adjusted gap */}
                <NotificationsBell />

                <Button
                    onClick={handleLogout}
                    variant="ghost" // For a subtle icon button
                    size="icon"
                    aria-label="Logout"
                    className="text-muted-foreground hover:text-foreground" // Subtle color, brightens on hover
                >
                    <LogOut className="h-5 w-5" /> {/* Lucide icon */}
                </Button>
            </div>
        </header>
    );
}