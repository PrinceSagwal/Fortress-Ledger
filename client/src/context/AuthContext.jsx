import { createContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    // Check local storage on load to persist UI state (Token is in http-only cookie)
    useEffect(() => {
        const storedUser = localStorage.getItem('fortress_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const userData = { email, role: res.data.role };
        setUser(userData);
        localStorage.setItem('fortress_user', JSON.stringify(userData));
        return res.data.role;
    };

    const register = async (email, password, role) => {
        await api.post('/auth/register', { email, password, role });
    };

    const logout = async () => {
        await api.post('/auth/logout');
        setUser(null);
        localStorage.removeItem('fortress_user');
        navigate('/');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};