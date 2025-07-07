// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

// Providers and Hooks
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Global Components
import { Toaster } from 'sonner';
import { ChatModal } from './components/chat/ChatModal'; // We will replace this later
import { MainAppLayout } from './layouts/MainAppLayout';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
// "Mode" Pages
import { CodeViewPage } from './pages/modes/CodeViewPage';
import { IntelligenceViewPage } from './pages/modes/IntelligenceViewPage';
import { TestingViewPage } from './pages/modes/TestingViewPage';
import { ChatViewPage } from './pages/modes/ChatViewPage';

// Standard Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { BetaInvitePage } from './pages/BetaInvitePage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';

// Set global Axios defaults
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;

/**
 * A component to handle the routing logic based on auth state.
 */
function AppRoutes() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <p>Loading session...</p>
            </div>
        );
    }

    return (
        <Routes>
            {isAuthenticated ? (
                // --- AUTHENTICATED ROUTES ---
                // All authenticated routes are now children of the MainAppLayout,
                // which provides the persistent, collapsible master sidebar.
                <Route path="/" element={<MainAppLayout />}>

                    {/* "Mode" Pages - These are the primary views of the application */}
                    <Route path="code/repository/:repoId/*" element={<CodeViewPage />} />
                    <Route path="intelligence" element={<IntelligenceViewPage />} />
                    <Route path="testing" element={<TestingViewPage />} />
                    <Route path="chat" element={<ChatViewPage />} />

                    {/* Standard Full-Page Views */}
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="settings/*" element={<SettingsLayout />} />

                    {/* Invite handling for logged-in users */}
                    <Route path="invite/:token" element={<AcceptInvitePage />} />

                    {/* --- Redirects for the authenticated state --- */}
                    {/* The root path "/" redirects to the user's dashboard */}
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    {/* A convenience redirect from "/code" to the dashboard */}
                    <Route path="code" element={<Navigate to="/dashboard" replace />} />
                    {/* A general catch-all that sends any other path to the dashboard */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
            ) : (
                // --- UNAUTHENTICATED ROUTES ---
                <>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/invite" element={<BetaInvitePage />} />
                    <Route path="/invite/:token" element={<AcceptInvitePage />} />

                    {/* Any other path redirects to the main invite page for unauthenticated users */}
                    <Route path="*" element={<Navigate to="/invite" replace />} />
                </>
            )}
        </Routes>
    );
}

/**
 * The main App component sets up all the providers and global components.
 */
function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <BrowserRouter>
                <AuthProvider>
                    {/* Global overlays are SIBLINGS to the main app container. */}
                    {/* This prevents them from being trapped by layout styles like CSS Grid. */}
                    <Toaster richColors closeButton position="top-right" />
                    <ChatModal />

                    {/* This div is the single root for our entire visible application. */}
                    {/* It ensures a consistent full-height context for all routes. */}
                    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
                        <AppRoutes />
                    </div>
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;