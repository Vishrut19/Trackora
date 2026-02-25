import { AuthProvider, useAuth } from '@/lib/auth-context';
import { getDeviceInfo } from '@/lib/device';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import '../global.css';

const HAS_VISITED_KEY = 'workflow_has_visited';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isCheckingFirstVisit, setIsCheckingFirstVisit] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const handleRouting = async () => {
      console.log('🔍 Routing check:', { loading, session: !!session, segments });

      if (loading) return;

      // Reset role when session changes (logout/login)
      if (!session) {
        setRole(null);
        setLoadingRole(false);
      }

      const inAuthGroup = segments[0] === 'auth';

      console.log('📍 Current location:', { inAuthGroup, hasSession: !!session });

      try {
        if (!session) {
          // No session - redirect to auth pages if not already there
          if (!inAuthGroup) {
            const hasVisited = await AsyncStorage.getItem(HAS_VISITED_KEY);
            if (cancelled) return;

            console.log('👤 Not authenticated, hasVisited:', hasVisited);

            if (hasVisited) {
              console.log('➡️ Redirecting to LOGIN');
              router.replace('/auth/login');
            } else {
              console.log('➡️ Redirecting to SIGNUP');
              await AsyncStorage.setItem(HAS_VISITED_KEY, 'true');
              router.replace('/auth/signup');
            }
          }
          return;
        }

        // Has session - verify device before redirecting or allowing access
        if (inAuthGroup) {
          console.log('➡️ On auth page with session, waiting for signup to complete...');
          return;
        }

        // Fetch User Role if not already fetched
        if (!role && !loadingRole) {
          setLoadingRole(true);
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!cancelled && data && !error) {
              console.log('👤 User role fetched:', data.role);
              setRole(data.role);
            }
          } catch (e) {
            console.error('Error fetching role:', e);
          } finally {
            if (!cancelled) setLoadingRole(false);
          }
        }

        if (cancelled) return;

        // Not on auth pages - do device verification
        try {
          const deviceInfo = await getDeviceInfo();
          if (cancelled) return;

          // Check if this is an admin device first (query by device_uuid only)
          console.log('🔍 _layout: Checking admin device for UUID:', deviceInfo.deviceId);
          const { data: adminDevices, error: adminDeviceError } = await supabase
            .from('user_devices')
            .select('*')
            .eq('device_uuid', deviceInfo.deviceId)
            .eq('is_admin_device', true)
            .eq('is_active', true)
            .limit(1);

          console.log('🔍 _layout: Admin device query result:', { adminDevices, adminDeviceError });

          if (adminDeviceError) {
            console.error('Error checking admin device:', adminDeviceError);
          }

          const isAdminDevice = adminDevices && adminDevices.length > 0;
          console.log('🔍 _layout: Is admin device:', isAdminDevice);

          if (isAdminDevice) {
            console.log('✅ Admin device detected - bypassing device binding check');
            // Admin device can access any account, skip normal device verification
          } else {
            // Retry device check a few times (device might still be registering)
            let devices = null;
            let retries = 3;

            while (retries > 0 && !cancelled) {
              const { data, error } = await supabase
                .from('user_devices')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('device_uuid', deviceInfo.deviceId)
                .eq('is_active', true);

              if (error) {
                console.error('Error verifying device:', error);
                break;
              }

              if (data && data.length > 0) {
                devices = data;
                break;
              }

              // No device found - wait and retry
              console.log('⏳ Device not found, retrying...');
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }

            if (cancelled) return;

            const isDeviceValid = devices && devices.length > 0;

            if (!isDeviceValid) {
              // Auto-register device for existing users
              console.log('📝 Auto-registering device for session user:', session.user.id);
              const { error: insertError } = await supabase
                .from('user_devices')
                .insert({
                  user_id: session.user.id,
                  device_uuid: deviceInfo.deviceId,
                  model: deviceInfo.modelName || deviceInfo.deviceName || null,
                  os_version: deviceInfo.platform || null,
                  is_active: true,
                  is_admin_device: false,
                });
              
              if (insertError) {
                console.error('❌ Device auto-registration failed:', insertError);
                console.log('🚫 Device not authorized after retries. Signing out.');
                await supabase.auth.signOut();
                if (!cancelled) {
                  Alert.alert('Unauthorized Device', 'This device is not registered for your account. Please contact your administrator.');
                }
                return;
              }
              console.log('✅ Device auto-registered and verified successfully');
            } else {
              console.log('✅ Device verified successfully');
            }
          }

          // After device verification, check for role-based redirection
          // Allow managers to access history and profile pages
          const allowedNonManagerRoutes = ['history', 'profile'];
          if (role === 'manager' && segments[0] !== '(manager)' && !allowedNonManagerRoutes.includes(segments[0])) {
            console.log('➡️ Redirecting to MANAGER dashboard');
            router.replace('/(manager)');
          } else if (role === 'staff' && segments[0] === '(manager)') {
            console.log('➡️ Staff trying to access manager area, redirecting to STAFF home');
            router.replace('/');
          }

        } catch (e) {
          console.error('Device check failed', e);
        }
      } finally {
        if (!cancelled) setIsCheckingFirstVisit(false);
      }
    };

    handleRouting();

    return () => { cancelled = true; };
  }, [session, loading, segments, role]);

  if (loading || isCheckingFirstVisit) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-black">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(manager)" />
      <Stack.Screen name="history" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/signup" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
