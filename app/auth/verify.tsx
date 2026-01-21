import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { firebaseAuth } from '@/lib/firebase.config';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, Text, View } from 'react-native';

export default function VerifyScreen() {
    const { phone, fullName, isSignup } = useLocalSearchParams();
    const router = useRouter();
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleVerify = async () => {
        if (token.length !== 6) {
            setError('Please enter a valid 6-digit code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // This will automatically trigger the Firebase auth state change
            // and our auth context will update

            // Note: We need to get the confirmation from the previous screen
            // For now, user will need to re-request OTP if they navigate back
            // A better implementation would store confirmation globally

            // Create Supabase profile if this is a signup
            if (isSignup === 'true' && firebaseAuth.currentUser) {
                const user = firebaseAuth.currentUser;

                // Create profile in Supabase
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.uid,
                        full_name: fullName as string,
                        phone: phone as string,
                        role: 'staff',
                        is_active: true,
                    });

                if (profileError) {
                    console.error('Profile creation error:', profileError);
                }
            }

            router.replace('/');
        } catch (err: any) {
            Alert.alert('Error', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
            <View className="flex-1 px-6 justify-center">
                <Text className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
                    Verify OTP
                </Text>
                <Text className="text-gray-500 mb-8 dark:text-gray-400">
                    Enter the 6-digit code sent to {phone}
                </Text>

                <AuthInput
                    label="Verification Code"
                    value={token}
                    onChangeText={setToken}
                    placeholder="123456"
                    keyboardType="number-pad"
                    maxLength={6}
                    error={error}
                />

                <AuthButton
                    title="Verify Code"
                    onPress={handleVerify}
                    loading={loading}
                    disabled={token.length !== 6}
                />

                <View className="mt-4 items-center">
                    <Text className="text-gray-500 dark:text-gray-400 text-sm">
                        Didn't receive code? Go back and try again
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}
