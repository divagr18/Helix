import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

// Assuming CodeSymbol type is defined similarly to SymbolDetailPage
interface CodeSymbolSearchResult {
    id: number;
    unique_id: string;
    name: string;
    // Add other fields you want to display from CodeSymbolSerializer
    documentation: string | null;
}

export function SearchResultsPage() {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q');
    const [results, setResults] = useState<CodeSymbolSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (query) {
            setLoading(true);
            setError(null);
            axios.get(`http://localhost:8000/api/v1/search/semantic/?q=${encodeURIComponent(query)}`, { withCredentials: true })
                .then(response => {
                    setResults(response.data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching search results:", err);
                    setError("Failed to load search results.");
                    setLoading(false);
                });
        } else {
            setResults([]); // Clear results if no query
        }
    }, [query]);

    return (
        <div style={{ padding: '20px 40px', fontFamily: 'sans-serif', backgroundColor: '#1e1e1e', color: '#d4d4d4', minHeight: '100vh' }}>
            <h1 style={{ color: '#569cd6' }}>Search Results for: "{query}"</h1>

            {loading && <p>Loading results...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && results.length === 0 && query && (
                <p>No results found for "{query}". Try a different search term.</p>
            )}

            {!loading && !error && results.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {results.map(symbol => (
                        <li key={symbol.id} style={{ backgroundColor: '#252526', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #333' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '5px' }}>
                                <Link to={`/symbol/${symbol.id}`} style={{ color: '#9cdcfe', textDecoration: 'none' }}>
                                    {symbol.name}
                                </Link>
                            </h3>
                            <p style={{ fontSize: '0.85em', color: '#888', marginBottom: '10px' }}>{symbol.unique_id}</p>
                            <p style={{ fontSize: '0.9em', color: '#ccc', whiteSpace: 'pre-wrap', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {symbol.documentation || "No documentation available."}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}