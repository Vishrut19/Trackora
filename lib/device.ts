import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
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

const DEVICE_ID_KEY = 'trackora_device_id';

/**
 * Get unique device identifier
 * On Android: Uses androidId
 * On iOS: Uses identifierForVendor
 * Fallback: Generates and saves a UUID if native modules fail
 */
export async function getDeviceId(): Promise<string> {
  // Try to get existing saved ID first
  const savedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (savedId) return savedId;

  let deviceId = '';

  try {
    if (Platform.OS === 'android') {
      deviceId = Application.getAndroidId();
    } else if (Platform.OS === 'ios') {
      deviceId = (await Application.getIosIdForVendorAsync()) || '';
    }
  } catch (error) {
    console.warn('Native Device ID failed, falling back to UUID:', error);
  }

  // If no native ID found, generate an unique one and save it
  if (!deviceId || deviceId === 'unknown-android' || deviceId === 'unknown-ios') {
    deviceId = `dev-${uuidv4()}`;
  }

  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
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
