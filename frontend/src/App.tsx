// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import './App.css';
import axios from 'axios'; // Import axios here
import { RepoDetailPage } from './pages/RepoDetailPage';
import { SymbolDetailPage } from './pages/SymbolDetailPage'; // Import the new page

axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/repository/:repoId" element={<RepoDetailPage />} />
        <Route path="/symbol/:symbolId" element={<SymbolDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;