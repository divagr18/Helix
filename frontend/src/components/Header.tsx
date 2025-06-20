import React, { useState } from 'react'; // Added React for FormEvent type if not already there
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios'; // For logout
import { FaSearch, FaCode, FaSignOutAlt } from 'react-icons/fa'; // Added FaSignOutAlt
import { NotificationsBell } from './NotificationBell'; // Import the bell

export function Header() {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => { // Added type for e
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
            // Optionally clear search term after submission
            // setSearchTerm(''); 
        }
    };

    const handleLogout = async () => {
        try {
            // Assuming your logout endpoint is /api/v1/auth/logout/ and uses POST
            await axios.post('http://localhost:8000/api/v1/auth/logout/', {}, { 
                withCredentials: true 
                // No CSRF token needed for logout if it's a simple session invalidation
                // but if your backend requires it for POST, you'd add it:
                // headers: { 'X-CSRFToken': getCookie('csrftoken') } 
            });
            // Force a full page reload to clear all state and redirect to login via App.tsx logic
            window.location.href = '/'; 
        } catch (error) {
            console.error("Logout failed:", error);
            // You might want to show an error message to the user
            alert("Logout failed. Please try again.");
        }
    };

    return (
        <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 40px',
            backgroundColor: '#252526',
            borderBottom: '1px solid #333',
            color: '#d4d4d4',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            height: '65px', // Slightly increased height for better vertical alignment
        }}>
            {/* Logo/Title Section */}
            <Link to="/dashboard" style={{ 
                textDecoration: 'none', 
                color: '#d4d4d4', 
                display: 'flex', 
                alignItems: 'center' 
            }}>
                <FaCode size="1.8em" style={{ marginRight: '10px', color: '#569cd6' }} /> {/* Adjusted size */}
                <h2 style={{ margin: 0, fontSize: '1.4em', fontWeight: 600 }}>Helix CME</h2> {/* Adjusted size */}
            </Link>

            {/* Search Bar Section - Centered (if space allows) */}
            <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
                <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', maxWidth: '500px', width: '100%' }}>
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Semantic code search..."
                        style={{
                            padding: '9px 12px', // Adjusted padding
                            fontSize: '0.9em',
                            borderRadius: '6px 0 0 6px', // Slightly more rounded
                            border: '1px solid #444', // Darker border
                            borderRight: 'none',
                            backgroundColor: '#1e1e1e',
                            color: '#c9d1d9', // Lighter text for input
                            flexGrow: 1, // Allow input to grow
                        }}
                    />
                    <button
                        type="submit"
                        title="Search"
                        style={{
                            padding: '9px 15px', // Adjusted padding
                            cursor: 'pointer',
                            backgroundColor: '#569cd6',
                            color: '#fff',
                            border: '1px solid #569cd6',
                            borderRadius: '0 6px 6px 0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.9em',
                        }}
                    >
                        <FaSearch size="1.1em" /> {/* Slightly larger icon */}
                    </button>
                </form>
            </div>

            {/* User Actions Section (Notifications & Logout) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <NotificationsBell /> {/* <<< ADDED NOTIFICATIONS BELL */}
                
                <button
                    onClick={handleLogout}
                    title="Logout"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#c9d1d9', // Match other icon colors
                        cursor: 'pointer',
                        fontSize: '1.5em', // Match bell icon size
                        padding: '0', // Remove padding if just icon
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    <FaSignOutAlt />
                </button>
            </div>
        </header>
    );
}