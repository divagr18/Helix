// src/utils/api.ts
import axios from 'axios';

const BASE_API_URL =
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:8000';

export const api = axios.create({
    baseURL: BASE_API_URL,
    withCredentials: true,     // <- ensure cookies (sessionid + csrftoken) are sent
});

// Optionally, set up a CSRF interceptor:
api.interceptors.request.use(config => {
    const csrftoken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    if (csrftoken && config.method !== 'get') {
        config.headers!['X-CSRFToken'] = csrftoken;
    }
    return config;
});

export default api;
