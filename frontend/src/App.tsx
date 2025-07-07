// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';

// Providers and Hooks
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useWorkspaceStore } from './stores/workspaceStore';

// Global Components
import { Header } from './components/Header';
import { Toaster } from 'sonner';
import { ChatModal } from './components/chat/ChatModal';
import { GlobalKeyboardShortcuts } from './components/GlobalKeyboardShortcuts';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RepoDetailPage } from './pages/RepoDetailPage';
import { SymbolDetailPage } from './pages/SymbolDetailPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage';
import { WorkspaceSettingsPage } from './pages/settings/WorkspaceSettingsPage';
import { DependencyGraphPage } from './pages/DependencyGraphPage';
import { BetaInvitePage } from './pages/BetaInvitePage'; // For new user sign-ups
import { AcceptInvitePage } from './pages/AcceptInvitePage'; // For joining a workspace
import { ActivityFeed } from './components/repo-detail/ActivityFeed';
import { ActivityPage } from './pages/ActivityPage';
// Set global Axios defaults
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;

/**
 * A layout component that includes the Header and handles global logic
 * for authenticated routes, like fetching workspaces.
 */
const AuthenticatedLayout = () => {
    const { workspaces, setWorkspaces, activeWorkspace, setActiveWorkspace } = useWorkspaceStore();
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = React.useState(true);

    React.useEffect(() => {
        axios.get('/api/v1/organizations/')
            .then(response => {
                const fetchedWorkspaces = response.data;
                setWorkspaces(fetchedWorkspaces);
                if (fetchedWorkspaces.length > 0) {
                    const activeExists = activeWorkspace && fetchedWorkspaces.some(w => w.id === activeWorkspace.id);
                    if (!activeExists) {
                        setActiveWorkspace(fetchedWorkspaces[0]);
                    }
                } else {
                    setActiveWorkspace(null);
                }
            })
            .catch(err => console.error("Failed to fetch workspaces", err))
            .finally(() => setIsLoadingWorkspaces(false));
    }, [setWorkspaces, setActiveWorkspace, activeWorkspace]);

    if (isLoadingWorkspaces) {
        return (
            <div className="flex justify-center items-center h-full">
                Loading your workspace...
            </div>
        );
    }

    return (
        <div className="grid h-full grid-rows-[auto_1fr] bg-background text-foreground">
            <Header />
            <GlobalKeyboardShortcuts />
            <main className="overflow-y-auto min-h-0">
                <Outlet />
            </main>
        </div>
    );
};

/**
 * A component to handle the routing logic based on auth state.
 */
function AppRoutes() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                Loading...
            </div>
        );
    }

    return (
        <Routes>
            {isAuthenticated ? (
                // --- Authenticated Routes ---
                <Route path="/" element={<AuthenticatedLayout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="repository/:repoId" element={<RepoDetailPage />} />
                    <Route path="repository/:repoId/architecture" element={<DependencyGraphPage />} />
                    <Route path="repository/:repoId/activity" element={<ActivityPage />} />

                    <Route path="symbol/:symbolId" element={<SymbolDetailPage />} />
                    <Route path="search" element={<SearchResultsPage />} />

                    {/* Unified Settings Routes */}
                    <Route path="settings" element={<SettingsLayout />}>
                        <Route index element={<Navigate to="profile" replace />} />
                        <Route path="profile" element={<ProfileSettingsPage />} />
                        <Route path="workspace" element={<WorkspaceSettingsPage />} />
                    </Route>

                    {/* User can accept a workspace invite while logged in */}
                    <Route path="invite/:token" element={<AcceptInvitePage />} />

                    {/* Catch-all for logged-in users redirects to dashboard */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
            ) : (
                // --- Unauthenticated Routes ---
                <>
                    <Route path="/login" element={<LoginPage />} />
                    {/* The main entry point for the closed beta */}
                    <Route path="/invite" element={<BetaInvitePage />} />
                    {/* This route is for accepting workspace invites, but the component will redirect to login */}
                    <Route path="/invite/:token" element={<AcceptInvitePage />} />
                    {/* Any other path redirects to the beta invite page */}
                    <Route path="*" element={<Navigate to="/invite" replace />} />
                </>
            )}
        </Routes>
    );
}

/**
 * The main App component sets up all the providers.
 */
function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <BrowserRouter>
                <AuthProvider>
                    <Toaster richColors closeButton position="top-right" />
                    <ChatModal />
                    <div className="h-full">
                        <AppRoutes />
                    </div>
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;