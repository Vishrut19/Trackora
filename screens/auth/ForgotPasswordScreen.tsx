import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { getNetworkErrorMessage, supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, useColorScheme, View } from 'react-native';

const TINT_LIGHT = "#0a7ea4";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: 'workflow://auth/reset-password' }
      );

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err: any) {
      const networkMsg = getNetworkErrorMessage(err);
      const message = networkMsg || err.message || 'An unexpected error occurred';
      const alertMessage = networkMsg
        ? 'Unable to connect to server.\n\nIf you are on JIO network, please try:\n• Switching to WiFi\n• Using another network (Airtel/BSNL)\n• Enabling a VPN'
        : message;
      Alert.alert(networkMsg ? 'Connection Error' : 'Request Failed', alertMessage);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEmail("");
    setSuccess(false);
    setError("");
  };

  const linkColor = colorScheme === "dark" ? "#fff" : TINT_LIGHT;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          WorkFlow
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Reset your password
        </Text>

        <View
          className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-6 w-full self-center"
          style={{
            maxWidth: 400,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          {!success ? (
            <>
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Forgot Password?
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-sm mb-5">
                Enter your email and we'll send you a reset link
              </Text>

              <AuthInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                error={error}
              />

              <AuthButton
                title="Send Reset Link"
                onPress={handleSubmit}
                loading={loading}
                disabled={!email}
              />
            </>
          ) : (
            <>
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Check your email!
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-sm mb-5">
                We've sent a reset link to {email}
              </Text>

              <AuthButton
                title="Try a different email"
                onPress={handleReset}
                loading={false}
              />
            </>
          )}

          <View className="mt-6 items-center">
            <Pressable onPress={() => router.back()}>
              <Text
                style={{ color: linkColor }}
                className="font-bold text-sm"
              >
                ← Back to Login
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
