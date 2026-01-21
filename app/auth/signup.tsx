import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { firebaseAuth } from '@/lib/firebase.config';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, Text, View } from 'react-native';

export default function SignupScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState({ name: '', phone: '' });

    const handleSignup = async () => {
        let hasError = false;
        const newError = { name: '', phone: '' };

        if (!fullName.trim()) {
            newError.name = 'Full name is required';
            hasError = true;
        }

        // Remove spaces and dashes
        const cleanedPhone = phone.replace(/\s+/g, '').replace(/-/g, '');

        let finalPhone = cleanedPhone;
        if (!cleanedPhone.startsWith('+')) {
            finalPhone = `+91${cleanedPhone}`;
        }

        if (finalPhone.length < 13) { // +91 + 10 digits
            newError.phone = 'Please enter a valid phone number';
            hasError = true;
        }

        if (hasError) {
            setError(newError);
            return;
        }

        setLoading(true);

        try {
            // Send OTP via Firebase
            const confirmation = await firebaseAuth.signInWithPhoneNumber(finalPhone);

            // Store name temporarily for profile creation after verification
            // We'll create the Supabase profile after successful OTP verification
            router.push({
                pathname: '/auth/verify',
                params: {
                    phone: finalPhone,
                    fullName: fullName,
                    isSignup: 'true'
                },
            });
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
            <View className="flex-1 px-6 justify-center">
                <Text className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
                    Create Account
                </Text>
                <Text className="text-gray-500 mb-8 dark:text-gray-400">
                    Join Trackora to start tracking your work
                </Text>

                <AuthInput
                    label="Full Name"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="John Doe"
                    error={error.name}
                />

                <AuthInput
                    label="Phone Number"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                    error={error.phone}
                />

                <AuthButton
                    title="Sign Up"
                    onPress={handleSignup}
                    loading={loading}
                    disabled={!fullName || !phone}
                />

                <View className="mt-8 flex-row justify-center">
                    <Text className="text-gray-500 dark:text-gray-400">Already have an account? </Text>
                    <Link href="/auth/login" className="font-bold text-black dark:text-white">
                        Login
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
}
