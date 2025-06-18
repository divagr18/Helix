import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaSearch, FaCode } from 'react-icons/fa'; // FaCode for a simple logo

export function Header() {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
            // Optionally clear search term after submission
            // setSearchTerm(''); 
        }
    };

    return (
        <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 40px', // Match padding of SymbolDetailPage
            backgroundColor: '#252526', // Slightly different from page background for definition
            borderBottom: '1px solid #333',
            color: '#d4d4d4',
            position: 'sticky', // Make header sticky
            top: 0,
            zIndex: 1000, // Ensure it's above other content
        }}>
            {/* Logo/Title Section */}
            <Link to="/dashboard" style={{ textDecoration: 'none', color: '#d4d4d4', display: 'flex', alignItems: 'center' }}>
                <FaCode size="2em" style={{ marginRight: '10px', color: '#569cd6' }} />
                <h2 style={{ margin: 0, fontSize: '1.5em' }}>Helix CME</h2>
            </Link>

            {/* Search Bar Section */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center' }}>
                <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Semantic code search..."
                    style={{
                        padding: '8px 12px',
                        fontSize: '0.9em',
                        borderRadius: '4px 0 0 4px', // Rounded left corners
                        border: '1px solid #555',
                        borderRight: 'none', // Remove right border to join with button
                        backgroundColor: '#1e1e1e', // Darker input background
                        color: '#fff',
                        minWidth: '300px', // Give it some default width
                    }}
                />
                <button
                    type="submit"
                    title="Search"
                    style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        backgroundColor: '#569cd6', // Accent color for button
                        color: '#fff',
                        border: '1px solid #569cd6',
                        borderRadius: '0 4px 4px 0', // Rounded right corners
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9em',
                    }}
                >
                    <FaSearch />
                </button>
            </form>

            {/* Placeholder for User Profile/Logout - Add later if needed */}
            {/* <div>User Profile</div> */}
        </header>
    );
}