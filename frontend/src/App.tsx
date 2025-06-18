// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import './App.css';
import axios from 'axios'; // Import axios here
import { Header } from './components/Header'; // Import the Header
import { useEffect, useState } from 'react';
import { RepoDetailPage } from './pages/RepoDetailPage';
import { SymbolDetailPage } from './pages/SymbolDetailPage';
import { SearchResultsPage } from './pages/SearchResultsPage'; // Import
// Import the new page

axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Header />
      <main>{children}</main> {/* Pages will be rendered here */}
    </>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Simple auth check on app load (you might have a more robust context/state for this)
  useEffect(() => {
    axios.get('http://localhost:8000/api/v1/auth/check/', { withCredentials: true })
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setLoadingAuth(false));
  }, []);

  // A helper component to conditionally render the Header
  const AppContent = () => {
    const location = useLocation();
    const showHeader = location.pathname !== '/'; // Don't show header on login page

    return (
      <>
        {showHeader && isAuthenticated && <Header />} {/* Show header if not login and authenticated */}
        <Routes>
          <Route path="/" element={<LoginPage />} />
          {/* Wrap authenticated routes */}
          {isAuthenticated ? (
            <>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/repository/:repoId" element={<RepoDetailPage />} />
              <Route path="/symbol/:symbolId" element={<SymbolDetailPage />} />
              <Route path="/search" element={<SearchResultsPage />} />
            </>
          ) : (
            // Optionally, redirect to login or show a "not authenticated" message
            // For now, these routes just won't match if not authenticated
            <Route path="*" element={<LoginPage />} /> // Redirect to login if not authenticated and trying other paths
          )}
        </Routes>
      </>
    );
  };

  if (loadingAuth) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1e1e1e', color: '#d4d4d4' }}>Loading authentication...</div>;
  }

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;