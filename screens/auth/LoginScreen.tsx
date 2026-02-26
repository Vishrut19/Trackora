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
    console.log("SUPABASE URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);
    console.log(
      "ANON KEY (first 20):",
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20),
    );
    if (!email.trim() || !password) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);
    setError("");

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });

      if (authError) throw authError;

      const deviceInfo = await getDeviceInfo();
      const deviceId = deviceInfo.deviceId;
      console.log('📱 Device ID:', deviceId);
      Alert.alert('Debug', `Device ID: ${deviceId}`);

      // First check: query ALL devices with this device_uuid to see what's in DB
      const { data: allDevices, error: allDevicesError } = await supabase
        .from('user_devices')
        .select('*');
      
      console.log('🔍 ALL devices in DB:', allDevices);
      const matchingDevice = allDevices?.find(d => d.device_uuid === deviceId);
      console.log('🔍 Matching device:', matchingDevice);
      Alert.alert('Debug', `Found: ${matchingDevice ? 'YES' : 'NO'} | Admin: ${matchingDevice?.is_admin_device}`);

      // Check if this is an admin device (query by device_uuid only, not user_id)
      let { data: adminDevices, error: adminDeviceError } = await supabase
        .from('user_devices')
        .select('*')
        .eq('device_uuid', deviceId)
        .eq('is_admin_device', true)
        .eq('is_active', true)
        .limit(1);

      console.log('🔍 Admin device query result:', { adminDevices, adminDeviceError });

      // Fallback: check by device model if UUID doesn't match
      if (!adminDevices || adminDevices.length === 0) {
        console.log('🔍 Trying fallback: checking by device model:', deviceInfo.modelName);
        const { data: modelDevices } = await supabase
          .from('user_devices')
          .select('*')
          .eq('model', deviceInfo.modelName)
          .eq('is_admin_device', true)
          .eq('is_active', true)
          .limit(1);
        
        if (modelDevices && modelDevices.length > 0) {
          console.log('🔍 Found admin device by model:', modelDevices);
          adminDevices = modelDevices;
          // Note: We don't update the UUID here - admin device records should stay tied to their original device
        }
      }

      Alert.alert('Debug', `Admin devices found: ${adminDevices?.length || 0}`);

      if (adminDeviceError) {
        console.error('❌ Admin device check error:', adminDeviceError);
        throw adminDeviceError;
      }

      const isAdminDevice = adminDevices && adminDevices.length > 0;
      console.log('✅ Is admin device:', isAdminDevice);

      // Admin device can login to ANY account (staff/manager/admin)
      if (isAdminDevice) {
        console.log('🔓 Admin device detected - allowing login');
        Alert.alert('Success', 'Admin device detected - allowing login');
        // Allow login - admin device bypasses normal device binding
        router.replace("/");
        return;
      }

      // Normal device check - must be registered to this user
      const { data: devices, error: deviceError } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', authData.user.id)
        .eq('device_uuid', deviceInfo.deviceId)
        .eq('is_active', true);

      if (deviceError) throw deviceError;

      if (!devices || devices.length === 0) {
        // No device found - auto-register this device for the user
        console.log('📝 Auto-registering device for user:', authData.user.id);
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
        
        if (insertError) {
          console.error('❌ Device registration failed:', insertError);
          await supabase.auth.signOut();
          throw new Error(
            "This device is not authorized. Please contact admin or login from your registered device.",
          );
        }
        console.log('✅ Device auto-registered successfully');
      }

      router.replace("/");
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
