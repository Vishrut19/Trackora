'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/lib/supabase';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Check if user has admin/manager role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user?.id)
                .single();

            if (profile?.role !== 'admin' && profile?.role !== 'manager') {
                await supabase.auth.signOut();
                throw new Error('Unauthorized. Access restricted to Admin/Manager roles.');
            }

            router.push('/');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight text-primary">WorkFlow</h1>
                    <p className="text-muted-foreground text-sm uppercase tracking-widest font-semibold">Admin Infrastructure</p>
                </div>

                <Card className="border-border bg-card shadow-2xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-foreground">Login</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Enter your credentials to access the management dashboard
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleLogin} className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 text-destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

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
                                        placeholder="admin@workflow.com"
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
                                        <LogIn className="mr-2 h-4 w-4" />
                                        Sign In to Dashboard
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 border-t border-border pt-6">
                        <p className="text-sm text-muted-foreground text-center w-full">
                            Don't have an account?{' '}
                            <Link href="/signup" className="text-primary font-bold hover:underline">
                                Register as Admin
                            </Link>
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
