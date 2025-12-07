import React from 'react';
import { useAuth } from './AuthContext';
import { User } from 'lucide-react';

interface UserAvatarProps {
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
}

export function UserAvatar({ onClick, size = 'sm' }: UserAvatarProps) {
    const { user } = useAuth();

    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    if (!user) return null;

    return (
        <button
            onClick={onClick}
            className={`${sizeClasses[size]} rounded-full bg-gray-100 text-gray-600 font-medium flex items-center justify-center hover:bg-gray-200 transition-colors overflow-hidden`}
        >
            {user.avatarUrl ? (
                <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                />
            ) : user.name ? (
                getInitials(user.name)
            ) : (
                <User className="w-4 h-4" />
            )}
        </button>
    );
}
