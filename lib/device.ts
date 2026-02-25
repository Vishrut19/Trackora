import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  brand: string | null;
  modelName: string | null;
}

const DEVICE_ID_KEY = 'workflow_device_id';

/**
 * Get unique device identifier
 * Uses a persisted UUID that survives app reinstalls (stored in AsyncStorage)
 * This ensures device authorization remains stable across app updates/reinstalls
 */
export async function getDeviceId(): Promise<string> {
  // Always use the saved ID if it exists - this ensures consistency
  const savedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (savedId) {
    return savedId;
  }

  // Generate a new persistent ID only if none exists
  const newDeviceId = `dev-${uuidv4()}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, newDeviceId);
  return newDeviceId;
}

/**
 * Get full device information for display/logging
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = await getDeviceId();
  let deviceName = 'Unknown Device';
  let brand = null;
  let modelName = null;

  try {
    deviceName = Device.deviceName || 'Unknown Device';
    brand = Device.brand;
    modelName = Device.modelName;
  } catch (error) {
    console.warn('Native Device Info failed:', error);
  }
  
  return {
    deviceId,
    deviceName,
    platform: Platform.OS,
    brand,
    modelName,
  };
}
