import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { getDeviceInfo } from '@/lib/device';
import { getNetworkErrorMessage, supabase } from '@/lib/supabase';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, useColorScheme, View } from 'react-native';

const TINT_LIGHT = "#0a7ea4";

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) throw authError;

      const deviceInfo = await getDeviceInfo();

      // Get all active devices for this user
      const { data: devices, error: deviceError } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', authData.user.id)
        .eq('is_active', true);

      if (deviceError) throw deviceError;

      if (!devices || devices.length === 0) {
        // No device registered at all - first time setup
        // Auto-register this device
        const { error: insertError } = await supabase
          .from('user_devices')
          .insert({
            user_id: authData.user.id,
            device_uuid: deviceInfo.deviceId,
            model: deviceInfo.modelName || deviceInfo.deviceName || null,
            os_version: deviceInfo.platform || null,
            is_active: true,
            is_admin_device: false,
          });

        if (insertError) throw insertError;
        // Continue to login successfully

      } else if (devices.length === 1) {
        // Exactly 1 device registered - safe to auto-update UUID
        // (handles reinstall / new APK changing UUID)
        const isCurrentDevice = devices[0].device_uuid === deviceInfo.deviceId;

        if (!isCurrentDevice) {
          // UUID changed - update to new UUID silently
          const { error: updateError } = await supabase
            .from('user_devices')
            .update({
              device_uuid: deviceInfo.deviceId,
              model: deviceInfo.modelName || deviceInfo.deviceName || null,
              os_version: deviceInfo.platform || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', devices[0].id);

          if (updateError) throw updateError;
        }
        // Continue to login successfully

      } else {
        // Multiple devices registered - strict check
        // Only allow if current device UUID matches one of them
        const isAuthorized = devices.some(
          d => d.device_uuid === deviceInfo.deviceId
        );

        if (!isAuthorized) {
          // Sign out and block - suspicious activity
          await supabase.auth.signOut();
          throw new Error(
            'This device is not authorized. Please contact your administrator.'
          );
        }
        // Continue to login successfully
      }

      router.replace('/');

    } catch (err: any) {
      const networkMsg = getNetworkErrorMessage(err);
      const message = networkMsg || err.message || 'An unexpected error occurred';
      const alertMessage = networkMsg
        ? 'Unable to connect to server.\n\nIf you are on JIO network, please try:\n• Switching to WiFi\n• Using another network (Airtel/BSNL)\n• Enabling a VPN'
        : message;
      Alert.alert(networkMsg ? 'Connection Error' : 'Login Failed', alertMessage);
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
          Sign in to continue tracking your attendance
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
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Welcome Back
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            Enter your credentials to continue
          </Text>

          <AuthInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={error && !password ? error : ""}
          />

          <AuthInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            showPasswordToggle
            error={error && password ? error : ""}
          />

          <AuthButton
            title="Login"
            onPress={handleLogin}
            loading={loading}
            disabled={!email || !password}
          />

          <View className="mt-4 items-center">
            <Link href="/auth/forgot-password" asChild>
              <Pressable>
                <Text
                  style={{ color: linkColor }}
                  className="font-bold text-sm"
                >
                  Forgot Password?
                </Text>
              </Pressable>
            </Link>
          </View>

          <View className="mt-6 flex-row justify-center flex-wrap">
            <Text className="text-gray-500 dark:text-gray-400 text-sm">
              Don't have an account?{" "}
            </Text>
            <Link href="/auth/signup" asChild>
              <Pressable>
                <Text
                  style={{ color: linkColor }}
                  className="font-bold text-sm"
                >
                  Sign Up
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
