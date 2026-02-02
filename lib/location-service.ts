import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

// Background task name
const LOCATION_TRACKING_TASK = 'background-location-tracking';

// Define the background task
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('❌ Location tracking error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (!location) return;

    const timestamp = new Date(location.timestamp);
    const timeString = timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    console.log('\n' + '='.repeat(60));
    console.log('📍 LOCATION UPDATE - ' + timeString);
    console.log('='.repeat(60));
    console.log('📊 Coordinates:');
    console.log('   Latitude:  ' + location.coords.latitude.toFixed(6));
    console.log('   Longitude: ' + location.coords.longitude.toFixed(6));
    console.log('   Accuracy:  ' + location.coords.accuracy.toFixed(2) + ' meters');
    console.log('⏰ Timestamp:  ' + timestamp.toISOString());

    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.warn('⚠️  No active session, stopping location tracking');
        await stopLocationTracking();
        return;
      }

      console.log('👤 User ID:    ' + session.user.id);

      // Save location to database
      const { error: insertError } = await supabase
        .from('location_logs')
        .insert({
          user_id: session.user.id,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          recorded_at: timestamp.toISOString(),
        });

      if (insertError) {
        console.error('❌ Database save FAILED:', insertError.message);
      } else {
        console.log('✅ Database save SUCCESS');
      }
    } catch (err) {
      console.error('❌ Error in location tracking task:', err);
    }
    
    console.log('='.repeat(60) + '\n');
  }
});

/**
 * Start background location tracking
 * Tracks location every 2 minutes with high accuracy
 */
export async function startLocationTracking(): Promise<boolean> {
  try {
    // Request permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.error('Foreground location permission not granted');
      return false;
    }

    // Request background permission (Android)
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission not granted - tracking will only work in foreground');
      // Continue anyway - foreground tracking is better than nothing
    }

    // Check if already tracking
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    
    if (isTracking) {
      console.log('Location tracking already active');
      return true;
    }

    // Start location tracking
    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
      accuracy: Location.Accuracy.Balanced, // Good balance between accuracy and battery
      timeInterval: 2 * 60 * 1000, // 2 minutes in milliseconds
      distanceInterval: 0, // Track even if user hasn't moved (for stationary workers)
      foregroundService: {
        notificationTitle: 'Trackora - Location Tracking',
        notificationBody: 'Tracking your location during work hours',
        notificationColor: '#2563EB', // Blue color
      },
      pausesUpdatesAutomatically: false, // Keep tracking even when stationary
      showsBackgroundLocationIndicator: true, // Show indicator on iOS (if ever needed)
    });

    console.log('\n' + '🚀'.repeat(30));
    console.log('✅ LOCATION TRACKING STARTED');
    console.log('📍 Updates every: 2 minutes');
    console.log('🔋 Accuracy: Balanced (battery-friendly)');
    console.log('📱 Foreground service: Active');
    console.log('🚀'.repeat(30) + '\n');
    return true;
  } catch (error) {
    console.error('❌ Error starting location tracking:', error);
    return false;
  }
}

/**
 * Stop background location tracking
 */
export async function stopLocationTracking(): Promise<boolean> {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    
    if (!isTracking) {
      console.log('Location tracking already stopped');
      return true;
    }

    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    console.log('\n' + '⏹️ '.repeat(30));
    console.log('✅ LOCATION TRACKING STOPPED');
    console.log('⏹️ '.repeat(30) + '\n');
    return true;
  } catch (error) {
    console.error('❌ Error stopping location tracking:', error);
    return false;
  }
}

/**
 * Check if location tracking is currently active
 */
export async function isLocationTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  } catch (error) {
    console.error('Error checking tracking status:', error);
    return false;
  }
}

/**
 * Get the last recorded location from the database
 */
export async function getLastRecordedLocation(userId: string) {
  try {
    const { data, error } = await supabase
      .from('location_logs')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching last location:', error);
    return null;
  }
}
