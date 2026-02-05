'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/lib/supabase';
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock, Mail, User, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const cleanEmail = email.trim().toLowerCase();

            // Signup from admin dashboard = admin by default
            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        role: 'admin',
                    },
                },
            });

            if (error) throw error;

            if (data.user) {
                setSuccess(true);
                setTimeout(() => {
                    router.push('/login');
                }, 3000);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4">
                <div className="w-full max-w-md text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="rounded-full bg-green-500/10 p-4 border border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Account Created!</h2>
                    <p className="text-muted-foreground">
                        Your admin account has been created successfully. Redirecting you to login...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight text-primary">WorkFlow</h1>
                    <p className="text-muted-foreground text-sm uppercase tracking-widest font-semibold">Admin Infrastructure</p>
                </div>

                <Card className="border-border bg-card shadow-2xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-foreground">Create Admin</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Register a new administrative account for this organization
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleSignup} className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 text-destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="pl-9 bg-input border-border text-foreground focus-visible:ring-ring"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-9 bg-input border-border text-foreground focus-visible:ring-ring"
                                        placeholder="name@organization.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-9 pr-10 bg-input border-border text-foreground focus-visible:ring-ring"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11"
                            >
                                {loading ? (
                                    <Loader size="sm" className="h-5 w-5" />
                                ) : (
                                    <>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        Register Admin
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 border-t border-border pt-6">
                        <p className="text-sm text-muted-foreground text-center w-full">
                            Already have an account?{' '}
                            <Link href="/login" className="text-primary font-bold hover:underline">
                                Sign in here
                            </Link>
                        </p>
                    </CardFooter>
                </Card>

                <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        Accounts created here have Admin access
                    </p>
                </div>
            </div>
        </div>
    );
}
