// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { getCookie } from '../utils'; // Adjust path as needed

// Define types for our data for type safety
interface TrackedRepository {
    id: number;
    full_name: string;
    status: string;
}

interface GithubRepository {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
}
export function DashboardPage() {
    // State for repos we are already tracking in our DB
    const [trackedRepos, setTrackedRepos] = useState<TrackedRepository[]>([]);
    const [trackedLoading, setTrackedLoading] = useState(true);

    // State for repos available on the user's GitHub account
    const [githubRepos, setGithubRepos] = useState<GithubRepository[]>([]);
    const [githubLoading, setGithubLoading] = useState(false);

    // State for showing/hiding the list of available repos
    const [showAddRepo, setShowAddRepo] = useState(false);

    // Function to fetch the repos we are already tracking
    const fetchTrackedRepos = () => {
        setTrackedLoading(true);
        axios.get('http://localhost:8000/api/v1/repositories/', { withCredentials: true })
            .then(response => {
                setTrackedRepos(response.data);
                setTrackedLoading(false);
            })
            .catch(err => {
                console.error("Error fetching tracked repositories:", err);
                setTrackedLoading(false);
            });
    };

    // Fetch tracked repos on initial page load
    useEffect(() => {
        fetchTrackedRepos();
    }, []);

    // Function to fetch available repos from GitHub via our backend proxy
    const handleFetchGithubRepos = () => {
        setShowAddRepo(true);
        setGithubLoading(true);
        axios.get('http://localhost:8000/api/v1/github-repos/', { withCredentials: true })
            .then(response => {
                setGithubRepos(response.data);
                setGithubLoading(false);
            })
            .catch(err => {
                console.error("Error fetching GitHub repositories:", err);
                setGithubLoading(false);
            });
    };

    // Function to handle adding a new repository
    const handleAddRepository = (repo: GithubRepository) => {
        const payload = {
            name: repo.name,
            full_name: repo.full_name,
            github_id: repo.id,
        };

        axios.post(
            'http://localhost:8000/api/v1/repositories/',
            payload,
            {
                withCredentials: true,
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                },
            }
        )
            .then(() => {
                // Success! Hide the add list and refresh our tracked repos
                setShowAddRepo(false);
                setGithubRepos([]);
                fetchTrackedRepos();
            })
            .catch(err => {
                console.error("Error adding repository:", err);
                alert(`Failed to add repository: ${err.response?.data?.full_name || 'Server error'}`);
            });
    };

    return (
        <div>
            <h1>Your Dashboard</h1>

            <h2>Tracked Repositories</h2>
            {trackedLoading ? <p>Loading...</p> : (
                trackedRepos.length === 0 ? (
                    <p>You are not tracking any repositories yet.</p>
                ) : (
                    <ul>
                        {trackedRepos.map(repo => (
                            <li key={repo.id}>
                                <Link to={`/repository/${repo.id}`}>{repo.full_name}</Link>
                                {' '}- <i>{repo.status}</i>
                            </li>
                        ))}
                    </ul>
                )
            )}

            <hr />

            {/* The "Add Repository" Section */}
            {!showAddRepo ? (
                <button onClick={handleFetchGithubRepos}>Add New Repository</button>
            ) : (
                <div>
                    <h2>Choose a Repository to Add</h2>
                    <button onClick={() => setShowAddRepo(false)}>Cancel</button>
                    {githubLoading ? <p>Loading your repos from GitHub...</p> : (
                        <ul>
                            {githubRepos.map(repo => (
                                <li key={repo.id}>
                                    {repo.full_name} {repo.private && '(Private)'}
                                    <button onClick={() => handleAddRepository(repo)} style={{ marginLeft: '10px' }}>
                                        Add
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}