import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { getNetworkErrorMessage, supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Text, useColorScheme, View } from 'react-native';

const TINT_LIGHT = "#0a7ea4";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(true);
  const [isRecoveryEventReceived, setIsRecoveryEventReceived] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryEventReceived(true);
          setIsVerifying(false);
        }
      }
    );

    // Give it a moment to receive the event, then assume we're ready
    const timeout = setTimeout(() => {
      setIsVerifying(false);
    }, 2000);

    return () => {
      authListener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const validatePasswords = (): boolean => {
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError('');

    if (!validatePasswords()) {
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      Alert.alert(
        'Success',
        'Password updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/auth/login'),
          },
        ]
      );
    } catch (err: any) {
      const networkMsg = getNetworkErrorMessage(err);
      const message = networkMsg || err.message || 'An unexpected error occurred';
      const alertMessage = networkMsg
        ? 'Unable to connect to server.\n\nIf you are on JIO network, please try:\n• Switching to WiFi\n• Using another network (Airtel/BSNL)\n• Enabling a VPN'
        : message;
      Alert.alert(networkMsg ? 'Connection Error' : 'Update Failed', alertMessage);
      setError(message);
    } finally {
      setLoading(false);
    }
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
          Create a new password
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
          {isVerifying ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={TINT_LIGHT} />
              <Text className="text-gray-500 dark:text-gray-400 text-sm mt-4">
                Verifying reset link...
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Reset Password
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-sm mb-5">
                Enter your new password below
              </Text>

              <AuthInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                secureTextEntry
                showPasswordToggle
                error={error && newPassword.length < 6 ? error : ""}
              />

              <AuthInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                secureTextEntry
                showPasswordToggle
                error={error && newPassword.length >= 6 ? error : ""}
              />

              <AuthButton
                title="Update Password"
                onPress={handleSubmit}
                loading={loading}
                disabled={!newPassword || !confirmPassword}
              />
            </>
          )}

          <View className="mt-6 items-center">
            <Pressable onPress={() => router.replace('/auth/login')}>
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
