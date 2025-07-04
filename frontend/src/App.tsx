// frontend/src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import { DependencyGraphPage } from './pages/DependencyGraphPage';
// Components
import { Header } from './components/Header';
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from 'sonner';
import { ChatModal } from './components/chat/ChatModal';
import { GlobalKeyboardShortcuts } from './components/GlobalKeyboardShortcuts'; // Keep this component as is

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RepoDetailPage } from './pages/RepoDetailPage';
import { SymbolDetailPage } from './pages/SymbolDetailPage';
import { SearchResultsPage } from './pages/SearchResultsPage';

// Axios Defaults
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;

/**
 * This is our main authenticated layout. It renders the common UI shell
 * and an <Outlet /> for the child pages to be rendered into.
 */
const AuthenticatedLayout = () => {
  return (
    // This div provides the overall flex-column structure for the entire authenticated app.
    // Your page components will replace the <Outlet /> and become the flex-grow element.
    <div className="flex flex-col h-full bg-background text-foreground">
      <Header />
      <GlobalKeyboardShortcuts />
      <main className="flex-grow min-h-0"> {/* The main content area will grow to fill space */}
        <Outlet /> {/* Child routes will be rendered here */}
      </main>
    </div>
  );
};

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        axios.get('http://localhost:8000/api/v1/auth/check/')
            .then(() => setIsAuthenticated(true))
            .catch(() => setIsAuthenticated(false))
            .finally(() => setLoadingAuth(false));
    }, []);

    if (loadingAuth) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0D1117', color: '#c9d1d9' }}>
                Loading...
            </div>
        );
    }

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <BrowserRouter>
                {/* Global components that are not part of the page layout */}
                <Toaster richColors closeButton position="top-right" />
                <ChatModal />
                <div className="h-full">
                <Routes>
                    {isAuthenticated ? (
                        // If authenticated, use the AuthenticatedLayout as a parent route.
                        // All nested routes will be rendered inside its <Outlet />.
                        <Route path="/" element={<AuthenticatedLayout />}>
                            <Route index element={<Navigate to="/dashboard" replace />} />
                            <Route path="dashboard" element={<DashboardPage />} />
                            <Route path="repository/:repoId" element={<RepoDetailPage />} />
                            <Route path="/repository/:repoId/architecture" element={<DependencyGraphPage />} />
                            <Route path="symbol/:symbolId" element={<SymbolDetailPage />} />
                            <Route path="search" element={<SearchResultsPage />} />
                            {/* A catch-all for any other authenticated path */}
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Route>
                    ) : (
                        // If not authenticated, only the login page is available.
                        <>
                            <Route path="/" element={<LoginPage />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </>
                    )}
                </Routes>
                </div>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;