import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export default function Index() {
    const { user, loading } = useAuth();
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');

    useEffect(() => {
        // Test Supabase connection
        const testConnection = async () => {
            try {
                const { error } = await supabase.from('profiles').select('count').limit(1);
                if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
                    // PGRST116 = table doesn't exist, PGRST205 = table not in schema cache
                    // Both mean Supabase is connected but tables aren't created yet
                    console.error('Supabase connection error:', error);
                    setConnectionStatus('error');
                } else {
                    setConnectionStatus('connected');
                }
            } catch (err) {
                console.error('Supabase connection error:', err);
                setConnectionStatus('error');
            }
        };

        testConnection();
    }, []);

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-black">
                <ActivityIndicator size="large" />
                <Text className="mt-4 text-gray-600 dark:text-gray-400">Loading...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 items-center justify-center bg-white dark:bg-black p-4">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Trackora
            </Text>

            <View className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg w-full max-w-md">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Connection Status
                </Text>

                <View className="flex-row items-center mb-4">
                    <View className={`w-3 h-3 rounded-full mr-2 ${connectionStatus === 'connected' ? 'bg-green-500' :
                        connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                        }`} />
                    <Text className="text-gray-700 dark:text-gray-300">
                        Supabase: {connectionStatus === 'connected' ? 'Connected' :
                            connectionStatus === 'error' ? 'Error' : 'Checking...'}
                    </Text>
                </View>

                <View className="flex-row items-center">
                    <View className={`w-3 h-3 rounded-full mr-2 ${user ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                    <Text className="text-gray-700 dark:text-gray-300">
                        Auth: {user ? 'Authenticated' : 'Not authenticated'}
                    </Text>
                </View>
            </View>

            <Text className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                Supabase integration is ready!
            </Text>
        </View>
    );
}
