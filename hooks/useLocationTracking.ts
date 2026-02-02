import { isLocationTrackingActive, startLocationTracking, stopLocationTracking } from '@/lib/location-service';
import { useEffect, useState } from 'react';

export function useLocationTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check tracking status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async (): Promise<boolean> => {
    const active = await isLocationTrackingActive();
    setIsTracking(active);
    return active;
  };

  const startTracking = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await startLocationTracking();
      if (success) {
        setIsTracking(true);
      }
      return success;
    } finally {
      setIsLoading(false);
    }
  };

  const stopTracking = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await stopLocationTracking();
      if (success) {
        setIsTracking(false);
      }
      return success;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isTracking,
    isLoading,
    startTracking,
    stopTracking,
    checkStatus,
  };
}
