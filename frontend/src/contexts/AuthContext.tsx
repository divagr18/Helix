import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    type ReactNode,
    useCallback,
} from 'react';
import axios from 'axios';
import { getCookie } from '@/utils';

axios.defaults.withCredentials = true;

const BASE_API_URL =
    import.meta.env.VITE_API_BASE_URL ||
    'https://woodcock-wondrous-infinitely.ngrok-free.app';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    checkAuth: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(
                `${BASE_API_URL}/api/v1/users/me/`,
                {
                    headers: { 'X-CSRFToken': getCookie('csrftoken') || '' },
                    withCredentials: true,
                }
            );
            setIsAuthenticated(true);
        } catch {
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await axios.post(
                `${BASE_API_URL}/api/v1/auth/logout/`,
                {},
                {
                    headers: { 'X-CSRFToken': getCookie('csrftoken') || '' },
                    withCredentials: true,
                }
            );
            setIsAuthenticated(false);
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout failed', error);
        }
    }, []);

    useEffect(() => {
        // Only checkAuth if we're not on a public page:
        const publicPages = ['/invite', '/login'];
        const isPublic = publicPages.some((p) =>
            window.location.pathname.startsWith(p)
        );
        if (!isPublic) {
            checkAuth();
        } else {
            setIsLoading(false);
        }
    }, [checkAuth]);

    return (
        <AuthContext.Provider
            value={{ isAuthenticated, isLoading, checkAuth, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside AuthProvider');
    return ctx;
};
