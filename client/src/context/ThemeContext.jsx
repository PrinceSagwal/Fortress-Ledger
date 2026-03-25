import { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
            setIsDarkMode(true);
            document.documentElement.classList.add('dark');
        } else {
            setIsDarkMode(false);
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = () => {
        const root = document.documentElement;
        if (isDarkMode) {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDarkMode(false);
        } else {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDarkMode(true);
        }
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};