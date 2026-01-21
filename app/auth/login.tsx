import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { firebaseAuth } from '@/lib/firebase.config';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, Text, View } from 'react-native';

export default function LoginScreen() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmation, setConfirmation] = useState<any>(null);

    const handleLogin = async () => {
        // Remove spaces and dashes
        const cleanedPhone = phone.replace(/\s+/g, '').replace(/-/g, '');

        let finalPhone = cleanedPhone;
        if (!cleanedPhone.startsWith('+')) {
            finalPhone = `+91${cleanedPhone}`;
        }

        if (finalPhone.length < 13) { // +91 + 10 digits
            setError('Please enter a valid phone number');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const confirmation = await firebaseAuth.signInWithPhoneNumber(finalPhone);
            setConfirmation(confirmation);

            router.push({
                pathname: '/auth/verify',
                params: { phone: finalPhone },
            });
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
                    Welcome Back
                </Text>
                <Text className="text-gray-500 mb-8 dark:text-gray-400">
                    Sign in to continue tracking your attendance
                </Text>

                <AuthInput
                    label="Phone Number"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                    error={error}
                />

                <AuthButton
                    title="Send OTP"
                    onPress={handleLogin}
                    loading={loading}
                    disabled={!phone}
                />

                <View className="mt-8 flex-row justify-center">
                    <Text className="text-gray-500 dark:text-gray-400">Don't have an account? </Text>
                    <Link href="/auth/signup" className="font-bold text-black dark:text-white">
                        Sign Up
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
}
