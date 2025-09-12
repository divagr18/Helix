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
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { RepoContextLoader } from './pages/modes/RepoContextLoader';
import { RefactorSymbolPage } from './pages/RefactorSymbolPage';
import LocalAnalysisPage from './pages/LocalAnalysisPage';

// Set global Axios defaults
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;

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
            {/* Routes accessible to everyone */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/invite/:token" element={<AcceptInvitePage />} />

            {isAuthenticated ? (
                // --- AUTHENTICATED ROUTES ---
                // The MainAppLayout is now the single entry point for the entire
                // authenticated application. It provides the persistent master sidebar.
                <Route path="/" element={<MainAppLayout />}>

                    {/* The Dashboard is the default page */}
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />

                    {/* The "IDE" View for a specific repository */}
                    {/* This route group is now correctly nested inside the MainAppLayout */}
                    <Route path="repository/:repoId" element={<RepoContextLoader />}>
                        <Route path="code" element={<CodeViewPage />} />
                        <Route path="intelligence" element={<IntelligenceViewPage />} />
                        <Route path="testing" element={<TestingViewPage />} />
                        <Route path="chat" element={<ChatViewPage />} />
                        {/* A default redirect for the repo root */}
                        <Route index element={<Navigate to="code" replace />} />
                    </Route>

                    {/* Other top-level pages */}
                    <Route path="settings/*" element={<SettingsLayout />} />
                    <Route path="local-analysis" element={<LocalAnalysisPage />} />
                    <Route path="invite/:token" element={<AcceptInvitePage />} />

                    {/* A general catch-all for any other path sends the user to their dashboard */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    <Route path="repository/:repoId/refactor/symbol/:symbolId" element={<RefactorSymbolPage />} />

                </Route>
            ) : (
                // --- UNAUTHENTICATED ROUTES ---
                <>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </>
            )}
        </Routes>
    );
}

// ... The rest of your App.tsx (App component, etc.) remains the same.

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