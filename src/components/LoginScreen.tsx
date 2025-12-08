import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { waitlistApi } from '@/lib/api';
import { Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function LoginScreen() {
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const { toast } = useToast();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) return;

        setIsLoggingIn(true);
        setError('');

        try {
            await login(password);
        } catch (err: any) {
            setError(err.message || 'Invalid password');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleJoinWaitlist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setIsJoiningWaitlist(true);

        try {
            const result = await waitlistApi.join(email);
            toast({
                title: "You're on the list! 🎉",
                description: result.message || "We'll reach out when there's a spot for you.",
            });
            setEmail('');
        } catch (err: any) {
            toast({
                title: 'Error',
                description: 'Failed to join waitlist. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsJoiningWaitlist(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-orange-100 flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Animated background blob */}
            <div
                className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-orange-200 to-orange-300 opacity-60 blur-3xl z-0"
                style={{
                    animation: 'breathe 10s ease-in-out infinite',
                }}
            />
            <style>{`
                @keyframes breathe {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.5); opacity: 0.7; }
                }
            `}</style>

            {/* Logo / Branding */}
            <div className="flex flex-col items-center mb-10 relative z-10">
                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-4">
                    <img src="/spot.png" alt="Spot" className="w-24 h-24 object-contain" />
                </div>
                <h1 className="text-4xl font-bold text-foreground tracking-tight">Spot</h1>
                <p className="text-muted-foreground mt-2 text-center">
                    Your Agent for Fun
                </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 relative z-10">
                <div className="relative">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full px-4 py-3 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm"
                        autoFocus
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoggingIn || !password.trim()}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                    {isLoggingIn ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Logging in...
                        </>
                    ) : (
                        'Login'
                    )}
                </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8 w-full max-w-sm relative z-10">
                <div className="flex-1 h-px bg-border" />
                <span className="text-sm text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
            </div>

            {/* Waitlist Form */}
            <div className="w-full max-w-sm relative z-10">
                <h2 className="text-lg font-semibold text-foreground text-center mb-3">
                    Join the Waitlist
                </h2>
                <form onSubmit={handleJoinWaitlist} className="space-y-3">
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isJoiningWaitlist || !email.trim()}
                        className="w-full py-3 rounded-xl bg-secondary text-foreground font-medium transition-all hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isJoiningWaitlist ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Joining...
                            </>
                        ) : (
                            'Join Waitlist'
                        )}
                    </button>
                </form>
            </div>

            {/* Footer */}
            <p className="text-xs text-muted-foreground mt-12 text-center relative z-10">
                Discover the best of NYC, one spot at a time.
            </p>
        </div>
    );
}
