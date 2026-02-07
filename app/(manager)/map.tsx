import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Clock,
  LogOut,
  MapPin,
  Navigation,
  RefreshCw,
  User,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Constants from "expo-constants";

const { width, height } = Dimensions.get("window");

// Get Google Maps API key from app config
const GOOGLE_MAPS_KEY =
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey || "";

// Lazy import MapView to catch load errors
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
let PROVIDER_GOOGLE: any = null;
let PROVIDER_DEFAULT: any = null;

let mapLoadError: string | null = null;

try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
} catch (e: any) {
  mapLoadError = e?.message || "Failed to load map library";
  console.error("Failed to load react-native-maps:", e);
}

// Reverse geocoding - uses Google Maps API (reliable) with Nominatim fallback
async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ place: string; area: string }> {
  // Try Google Maps Geocoding API first (fast & reliable)
  if (GOOGLE_MAPS_KEY) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}&language=en`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" && data.results?.length > 0) {
          return parseGoogleResult(data.results);
        }
      }
    } catch {
      // Fall through to Nominatim
    }
  }

  // Fallback: Nominatim (OpenStreetMap)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "WorkFlowApp/1.0",
        },
      },
    );
    if (!res.ok) return { place: "Location unavailable", area: "" };
    const data = await res.json();
    return parseNominatimResult(data);
  } catch {
    return { place: "Location unavailable", area: "" };
  }
}

// Parse Google Maps geocoding result into place + area
function parseGoogleResult(results: any[]): { place: string; area: string } {
  // Find the most useful result types
  let place = "";
  let area = "";

  // Extract components from the most detailed result
  const components = results[0]?.address_components || [];

  const getComponent = (type: string) =>
    components.find((c: any) => c.types.includes(type))?.long_name || "";

  const neighborhood = getComponent("neighborhood");
  const sublocality =
    getComponent("sublocality_level_1") || getComponent("sublocality");
  const locality = getComponent("locality");
  const district = getComponent("administrative_area_level_3");
  const state = getComponent("administrative_area_level_1");

  // Place: most specific area name
  place =
    neighborhood || sublocality || locality || district || "Unknown location";

  // Area: city + state (avoid repeating the place name)
  const cityPart = locality && locality !== place ? locality : district || "";
  if (cityPart && state) {
    area = `${cityPart}, ${state}`;
  } else if (state) {
    area = state;
  }

  return { place, area };
}

// Parse Nominatim result into place + area
function parseNominatimResult(data: any): { place: string; area: string } {
  const addr = data.address;
  if (!addr) {
    const parts =
      data.display_name?.split(",").map((s: string) => s.trim()) || [];
    return {
      place: parts[0] || "Unknown location",
      area: parts.slice(1, 3).join(", ") || "",
    };
  }

  const nearby =
    addr.neighbourhood ||
    addr.road ||
    addr.residential ||
    addr.industrial ||
    addr.suburb ||
    addr.hamlet ||
    "";
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.county ||
    addr.state_district ||
    "";
  const state = addr.state || "";
  const district = addr.district || addr.state_district || "";

  const placeLine = nearby || city || "Unknown location";
  let areaLine = "";
  if (city && state && city !== placeLine) {
    areaLine = `${city}, ${state}`;
  } else if (district && state) {
    areaLine = `${district}, ${state}`;
  } else if (state) {
    areaLine = state;
  } else if (city) {
    areaLine = city;
  }

  return { place: placeLine, area: areaLine };
}

export default function LiveMapScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const { userId, userName } = useLocalSearchParams<{ userId?: string; userName?: string }>();

  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapError, setMapError] = useState<string | null>(mapLoadError);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<{
    place: string;
    area: string;
  }>({ place: "", area: "" });
  const [addressLoading, setAddressLoading] = useState(false);

  // Bottom sheet animation
  const slideAnim = useRef(new Animated.Value(300)).current;
  const mapRef = useRef<any>(null);
  const isLoadingRef = useRef(false);
  const hasAutoSelectedRef = useRef(false);

  // Track if we're targeting a specific user from the dashboard
  const [trackingUserName, setTrackingUserName] = useState<string | null>(null);
  const [trackingUserNotFound, setTrackingUserNotFound] = useState(false);
  // When tracking a specific user, keep loading until their data is resolved
  const [targetResolved, setTargetResolved] = useState(!userId);
  const pendingAutoSelectRef = useRef<any>(null);

  useEffect(() => {
    loadTeamLocations(true);

    // Silent background polling every 1 minute - no spinners, no extra re-renders
    const interval = setInterval(() => loadTeamLocations(false), 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-select a specific user when navigated from dashboard with userId param
  useEffect(() => {
    if (!userId || locations.length === 0 || hasAutoSelectedRef.current) return;

    const targetUser = locations.find((loc) => loc.user_id === userId);
    if (targetUser) {
      hasAutoSelectedRef.current = true;
      setTrackingUserNotFound(false);
      // Store for auto-select after map renders
      pendingAutoSelectRef.current = targetUser;
      setTargetResolved(true);
    } else {
      // User has no recent location - try fetching their last known location
      hasAutoSelectedRef.current = true;
      setTrackingUserName(userName || null);
      fetchLastKnownLocation(userId);
    }
  }, [userId, locations]);

  // Fetch the last known location for a specific user (no time limit)
  const fetchLastKnownLocation = async (targetUserId: string) => {
    try {
      const { data: logs, error } = await supabase
        .from("location_logs")
        .select("user_id, latitude, longitude, recorded_at")
        .eq("user_id", targetUserId)
        .order("recorded_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (logs && logs.length > 0) {
        const loc = {
          ...logs[0],
          full_name: userName || "Unknown",
        };
        // Add this user to the locations array so their marker appears
        setLocations((prev) => {
          if (prev.find((l) => l.user_id === targetUserId)) return prev;
          return [...prev, loc];
        });
        setTrackingUserNotFound(false);
        pendingAutoSelectRef.current = loc;
      } else {
        // No location data at all for this user
        setTrackingUserNotFound(true);
      }
    } catch (error) {
      console.error("Error fetching last known location:", error);
      setTrackingUserNotFound(true);
    } finally {
      setTargetResolved(true);
    }
  };

  const loadTeamLocations = async (showSpinner: boolean = false) => {
    if (!session?.user) return;
    // Prevent concurrent loads
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    // Only show spinner on initial load or manual refresh
    if (showSpinner) setRefreshing(true);

    try {
      // Single RPC call replaces 3 sequential queries - ~3x faster on mobile
      const { data, error } = await supabase.rpc("get_team_locations", {
        p_manager_id: session.user.id,
      });

      if (error) throw error;

      setLocations(data || []);
    } catch (error) {
      console.error("Error loading map locations:", error);
    } finally {
      setLoading(false);
      if (showSpinner) setRefreshing(false);
      isLoadingRef.current = false;
    }
  };

  // Handle marker press - show bottom sheet with user details
  const handleMarkerPress = useCallback(
    async (loc: any) => {
      setSelectedUser(loc);
      setSelectedAddress({ place: "", area: "" });
      setAddressLoading(true);

      // Animate bottom sheet up
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();

      // Center map on the selected user
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );
      }

      // Reverse geocode the address
      try {
        const address = await reverseGeocode(loc.latitude, loc.longitude);
        setSelectedAddress(address);
      } catch {
        setSelectedAddress({ place: "Location unavailable", area: "" });
      } finally {
        setAddressLoading(false);
      }
    },
    [slideAnim],
  );

  // Close bottom sheet
  const closeBottomSheet = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSelectedUser(null);
      setSelectedAddress({ place: "", area: "" });
    });
  }, [slideAnim]);

  // Open in external maps app
  const openInMaps = useCallback(() => {
    if (!selectedUser) return;
    const { latitude, longitude } = selectedUser;
    const label = encodeURIComponent(selectedUser.full_name || "Team Member");
    const url =
      Platform.OS === "ios"
        ? `maps:0,0?q=${label}@${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps URL
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      );
    });
  }, [selectedUser]);

  // Navigate to member detail screen
  const viewMemberProfile = useCallback(() => {
    if (!selectedUser) return;
    closeBottomSheet();
    router.push(`/(manager)/member/${selectedUser.user_id}`);
  }, [selectedUser, router, closeBottomSheet]);

  // Get time ago string
  const getTimeAgo = (dateStr: string) => {
    const now = Date.now();
    const recorded = new Date(dateStr).getTime();
    const diffMs = now - recorded;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m ago`;
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  if (loading || !targetResolved) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color="#2563EB" />
        {userId && !targetResolved && (
          <Text className="text-gray-400 text-sm mt-3">
            Locating {userName || "team member"}...
          </Text>
        )}
      </View>
    );
  }

  // Center map on the targeted user if navigated from dashboard, otherwise first user
  const targetedLoc = userId
    ? locations.find((loc) => loc.user_id === userId)
    : null;

  const initialRegion =
    targetedLoc
      ? {
          latitude: targetedLoc.latitude,
          longitude: targetedLoc.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : locations.length > 0
        ? {
            latitude: locations[0].latitude,
            longitude: locations[0].longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }
        : {
            latitude: 28.6139, // Default to New Delhi if no data
            longitude: 77.209,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          };

  // Determine the map provider: Google Maps on Android (requires API key), Apple Maps on iOS
  const mapProvider =
    Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-black z-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900"
        >
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            Live Team Map
          </Text>
          <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            {locations.length} Members Online
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900"
        >
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View className="flex-1">
        {/* Map Error Fallback */}
        {mapError || !MapView ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-800 items-center w-full">
              <AlertTriangle size={40} color="#EF4444" />
              <Text className="text-lg font-bold text-gray-900 dark:text-white mt-4 text-center">
                Map Unavailable
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-sm text-center mt-2">
                {mapError ||
                  "The map component could not be loaded. Please ensure the app is built with native map support."}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setMapError(null);
                  loadTeamLocations(true);
                }}
                className="mt-4 bg-blue-600 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-medium">Retry</Text>
              </TouchableOpacity>
            </View>

            {/* Show team member locations as a list fallback */}
            {locations.length > 0 && (
              <View className="mt-6 w-full">
                <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Team Locations (List View)
                </Text>
                {locations.map((loc, index) => (
                  <View
                    key={`${loc.user_id}-${index}`}
                    className="flex-row items-center bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 mb-2"
                  >
                    <View className="bg-blue-600 p-2 rounded-full mr-3">
                      <User size={14} color="white" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-medium text-gray-900 dark:text-white">
                        {loc.full_name}
                      </Text>
                      <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Last seen:{" "}
                        {new Date(loc.recorded_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <MapPin size={16} color="#9CA3AF" />
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* Actual Map View */
          <MapView
            ref={mapRef}
            provider={mapProvider}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            onPress={() => {
              // Close bottom sheet when tapping on the map
              if (selectedUser) closeBottomSheet();
            }}
            onMapReady={() => {
              // Auto-select the pending user once map is ready
              if (pendingAutoSelectRef.current) {
                const loc = pendingAutoSelectRef.current;
                pendingAutoSelectRef.current = null;
                setTimeout(() => handleMarkerPress(loc), 300);
              }
            }}
            onError={(e: any) => {
              console.error("MapView error:", e?.nativeEvent?.error || e);
              setMapError(
                e?.nativeEvent?.error ||
                  "Map failed to load. Please check your Google Maps API key configuration.",
              );
            }}
          >
            {locations.map((loc, index) => (
              <Marker
                key={`${loc.user_id}-${index}`}
                coordinate={{
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                }}
                onPress={() => handleMarkerPress(loc)}
              >
                <View
                  style={[
                    styles.markerContainer,
                    selectedUser?.user_id === loc.user_id &&
                      styles.markerSelected,
                  ]}
                >
                  <User size={16} color="white" />
                </View>
              </Marker>
            ))}
          </MapView>
        )}

        {/* Refresh Button */}
        <TouchableOpacity
          onPress={() => loadTeamLocations(true)}
          disabled={refreshing}
          className="absolute bottom-10 right-6 bg-white dark:bg-gray-900 p-4 rounded-full shadow-lg border border-gray-100 dark:border-gray-800"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <RefreshCw size={24} color="#2563EB" />
          )}
        </TouchableOpacity>

        {/* Banner: No location data for tracked user */}
        {trackingUserNotFound && trackingUserName && (
          <View className="absolute top-4 left-4 right-4">
            <View
              style={{
                backgroundColor: "#FEF3C7",
                borderRadius: 16,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#FDE68A",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <AlertTriangle size={20} color="#D97706" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#92400E",
                  }}
                >
                  No location data for {trackingUserName}
                </Text>
                <Text
                  style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}
                >
                  Their device hasn't sent GPS data yet. They may need to
                  enable location permissions.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTrackingUserNotFound(false)}
                style={{
                  padding: 4,
                  marginLeft: 8,
                }}
              >
                <X size={16} color="#D97706" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!mapError && MapView && locations.length === 0 && !trackingUserNotFound && (
          <View className="absolute top-1/2 left-0 right-0 items-center">
            <View className="bg-white/90 dark:bg-black/90 px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <Text className="text-gray-900 dark:text-white font-medium">
                No team members are currently online
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-xs text-center mt-1">
                Check back later or check the team list
              </Text>
            </View>
          </View>
        )}

        {/* Bottom Sheet - Member Detail Panel */}
        {selectedUser && (
          <Animated.View
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Close button */}
            <TouchableOpacity
              onPress={closeBottomSheet}
              style={styles.closeButton}
            >
              <X size={18} color="#6B7280" />
            </TouchableOpacity>

            {/* User Info Row */}
            <View style={styles.userInfoRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {selectedUser.full_name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
              <View style={styles.userTextContainer}>
                <Text style={styles.userName}>{selectedUser.full_name}</Text>
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Online</Text>
                  <Text style={styles.statusDivider}>·</Text>
                  <Clock size={12} color="#6B7280" />
                  <Text style={styles.timeAgoText}>
                    {getTimeAgo(selectedUser.recorded_at)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Location Info */}
            <View style={styles.locationCard}>
              <MapPin size={16} color="#2563EB" style={{ marginTop: 2 }} />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Current Location</Text>
                {addressLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.loadingText}>Finding location...</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.locationAddress}>
                      {selectedAddress.place || "Unknown location"}
                    </Text>
                    {selectedAddress.area ? (
                      <Text style={styles.locationArea}>
                        {selectedAddress.area}
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButtonPrimary}
                onPress={viewMemberProfile}
              >
                <User size={16} color="white" />
                <Text style={styles.actionButtonPrimaryText}>View Profile</Text>
                <ChevronRight size={16} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButtonSecondary}
                onPress={openInMaps}
              >
                <Navigation size={16} color="#2563EB" />
                <Text style={styles.actionButtonSecondaryText}>Directions</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: width,
    height: height - 150,
  },
  markerContainer: {
    backgroundColor: "#2563EB",
    padding: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerSelected: {
    backgroundColor: "#1D4ED8",
    borderColor: "#BFDBFE",
    borderWidth: 3,
    transform: [{ scale: 1.2 }],
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563EB",
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
  statusDivider: {
    fontSize: 13,
    color: "#9CA3AF",
    marginHorizontal: 2,
  },
  timeAgoText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 2,
  },
  locationCard: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    alignItems: "flex-start",
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginTop: 3,
  },
  locationArea: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  loadingText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButtonPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  actionButtonPrimaryText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  actionButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  actionButtonSecondaryText: {
    color: "#2563EB",
    fontSize: 15,
    fontWeight: "700",
  },
});
