import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { firebaseAuth } from './firebase.config';

type AuthContextType = {
    user: FirebaseAuthTypes.User | null;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen for authentication state changes
        const unsubscribe = firebaseAuth.onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
