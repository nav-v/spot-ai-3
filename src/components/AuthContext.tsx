import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User } from '@/lib/api';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (updates: Partial<User>) => Promise<void>;
    updatePreferences: (preferences: Partial<User['preferences']>) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = async () => {
        try {
            const userData = await authApi.getUser();
            setUser(userData);
        } catch (error) {
            console.error('Failed to fetch user:', error);
            setUser(null);
        }
    };

    useEffect(() => {
        // Check for existing session on mount
        const checkAuth = async () => {
            setIsLoading(true);
            await refreshUser();
            setIsLoading(false);
        };
        checkAuth();
    }, []);

    const login = async (password: string) => {
        const { user: userData } = await authApi.login(password);
        setUser(userData);
    };

    const logout = async () => {
        await authApi.logout();
        setUser(null);
    };

    const updateUser = async (updates: Partial<User>) => {
        const updatedUser = await authApi.updateUser(updates);
        setUser(updatedUser);
    };

    const updatePreferences = async (preferences: Partial<User['preferences']>) => {
        const updatedUser = await authApi.updatePreferences(preferences);
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                logout,
                updateUser,
                updatePreferences,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
