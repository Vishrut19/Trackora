'use client';

import { Loader } from '@/components/ui/loader';
import { Mapcn, LIVE_MAP_ID } from '@/components/ui/map';
import { supabase } from '@/lib/supabase';
import { useMap, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LocationStatus = 'live' | 'lastSeen' | 'offline';

export interface LiveLocation {
    user_id: string;
    latitude: number;
    longitude: number;
    recorded_at: string;
    check_in_time?: string;
    profiles?: { full_name?: string } | null;
    placeName?: string;
    status: LocationStatus;
}

interface LiveMapProps {
    onLocationsUpdated?: (locations: LiveLocation[]) => void;
    selectedUserId?: string | null;
    onSelectUser?: (userId: string | null) => void;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
        );
        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
        const data = await res.json();

        const addr = data.address;
        if (!addr) {
            return data.display_name?.split(',').slice(0, 2).join(',').trim()
                || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }

        const city = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || '';
        const state = addr.state || '';

        if (city && state) return `${city}, ${state}`;
        if (city) return city;
        if (state) return state;

        return data.display_name?.split(',').slice(0, 2).join(',').trim()
            || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
        console.error('Reverse geocoding failed:', error);
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

function LiveMapInner({ onLocationsUpdated, selectedUserId, onSelectUser }: LiveMapProps) {
    const [locations, setLocations] = useState<LiveLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<LiveLocation | null>(null);
    const [showInfoWindow, setShowInfoWindow] = useState(false);
    const prevSelectedRef = useRef<string | null>(null);
    const geocodeCacheRef = useRef<Map<string, string>>(new Map());
    const locationsRef = useRef<LiveLocation[]>([]);
    const map = useMap(LIVE_MAP_ID);

    locationsRef.current = locations;

    useEffect(() => {
        loadLocations();
        const interval = setInterval(loadLocations, 60000);
        return () => clearInterval(interval);
    }, []);

    const geocodeLocation = useCallback(async (loc: LiveLocation) => {
        const cacheKey = `${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
        if (geocodeCacheRef.current.has(cacheKey)) {
            return geocodeCacheRef.current.get(cacheKey)!;
        }
        const name = await reverseGeocode(loc.latitude, loc.longitude);
        geocodeCacheRef.current.set(cacheKey, name);
        return name;
    }, []);

    // Reverse geocode locations that have coordinates
    useEffect(() => {
        const locsWithCoords = locations.filter(l => l.status !== 'offline');
        if (locsWithCoords.length === 0) return;
        let cancelled = false;

        const geocodeAll = async () => {
            const updated: LiveLocation[] = [];
            let changed = false;

            for (const loc of locations) {
                if (cancelled) return;
                if (loc.status === 'offline' || loc.placeName) {
                    updated.push(loc);
                    continue;
                }
                const placeName = await geocodeLocation(loc);
                updated.push({ ...loc, placeName });
                changed = true;
                if (locations.indexOf(loc) < locations.length - 1) {
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            if (!cancelled && changed) {
                setLocations(updated);
                onLocationsUpdated?.(updated);
            }
        };

        geocodeAll();
        return () => { cancelled = true; };
    }, [locations.length]);

    // Fit map to locations with coordinates only (reads latest from ref to avoid effect loops)
    const fitAllLocations = useCallback(() => {
        if (!map) return;
        const withCoords = locationsRef.current.filter(l => l.status !== 'offline');
        if (withCoords.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        withCoords.forEach(loc => {
            bounds.extend({ lat: loc.latitude, lng: loc.longitude });
        });
        map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
        google.maps.event.addListenerOnce(map, 'idle', () => {
            const z = map.getZoom();
            if (z !== undefined && z !== null && z > 14) map.setZoom(14);
        });
    }, [map]);

    // Fly to selected user or back to overview
    useEffect(() => {
        if (!map) return;
        const wasSelected = prevSelectedRef.current;
        prevSelectedRef.current = selectedUserId ?? null;

        if (!selectedUserId) {
            setSelectedUser(null);
            setShowInfoWindow(false);
            if (wasSelected) {
                fitAllLocations();
            }
            return;
        }

        const loc = locations.find(l => l.user_id === selectedUserId);
        if (!loc || loc.status === 'offline') return;
        setSelectedUser(loc);
        setShowInfoWindow(true);
        map.panTo({ lat: loc.latitude, lng: loc.longitude });
        map.setZoom(16);
    }, [selectedUserId, locations, map, fitAllLocations]);

    // On initial load or "Show All", fit to all locations (do not depend on locations ref to avoid loop)
    useEffect(() => {
        if (locations.length === 0 || selectedUserId) return;
        fitAllLocations();
    }, [locations.length, selectedUserId, fitAllLocations]);

    async function loadLocations() {
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const today = todayStart.toISOString().split('T')[0];
            const thirtyMinsAgo = Date.now() - 30 * 60000;

            // 1. Fetch today's location logs
            const { data: logs, error: logsError } = await supabase
                .from('location_logs')
                .select(`
                    user_id,
                    latitude,
                    longitude,
                    recorded_at,
                    profiles:user_id (full_name)
                `)
                .gte('recorded_at', todayStart.toISOString())
                .order('recorded_at', { ascending: false });

            if (logsError) throw logsError;

            // 2. Fetch today's attendance (checked in, not yet checked out)
            const { data: attendance, error: attError } = await supabase
                .from('attendance')
                .select(`
                    user_id,
                    check_in_time,
                    profiles:user_id (full_name)
                `)
                .eq('attendance_date', today)
                .is('check_out_time', null);

            if (attError) throw attError;

            // 3. Build latest location per user from logs
            const locationMap = new Map<string, LiveLocation>();
            logs?.forEach((log: any) => {
                if (!locationMap.has(log.user_id)) {
                    const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
                    const recordedTime = new Date(log.recorded_at).getTime();
                    locationMap.set(log.user_id, {
                        ...log,
                        profiles: profile ?? null,
                        status: recordedTime >= thirtyMinsAgo ? 'live' : 'lastSeen',
                    });
                }
            });

            // 4. Add offline staff (in attendance but no location logs)
            attendance?.forEach((att: any) => {
                if (!locationMap.has(att.user_id)) {
                    const profile = Array.isArray(att.profiles) ? att.profiles[0] : att.profiles;
                    locationMap.set(att.user_id, {
                        user_id: att.user_id,
                        latitude: 0,
                        longitude: 0,
                        recorded_at: att.check_in_time,
                        check_in_time: att.check_in_time,
                        profiles: profile ?? null,
                        status: 'offline',
                    });
                }
            });

            const allLocations = Array.from(locationMap.values());

            // Sort: live first, then lastSeen, then offline
            allLocations.sort((a, b) => {
                const order: Record<LocationStatus, number> = { live: 0, lastSeen: 1, offline: 2 };
                return order[a.status] - order[b.status];
            });

            setLocations(allLocations);
            onLocationsUpdated?.(allLocations);
        } catch (error) {
            console.error('Error loading locations:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading && locations.length === 0) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-2xl z-10">
                <Loader size="lg" />
            </div>
        );
    }

    // Only render markers for live and lastSeen (they have coordinates)
    const markersData = locations.filter(l => l.status !== 'offline');

    return (
        <>
            {markersData.map((loc) => (
                <Marker
                    key={loc.user_id}
                    position={{ lat: loc.latitude, lng: loc.longitude }}
                    onClick={() => {
                        setSelectedUser(loc);
                        setShowInfoWindow(true);
                        onSelectUser?.(loc.user_id);
                    }}
                    title={loc.profiles?.full_name ?? 'Unknown'}
                    opacity={loc.status === 'lastSeen' ? 0.55 : 1}
                />
            ))}

            {selectedUser && showInfoWindow && selectedUser.status !== 'offline' && (
                <InfoWindow
                    position={{ lat: selectedUser.latitude, lng: selectedUser.longitude }}
                    onCloseClick={() => {
                        setShowInfoWindow(false);
                    }}
                    pixelOffset={[0, -35]}
                >
                    <div style={{ minWidth: 220, padding: '14px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative' }}>
                        <button
                            onClick={() => setShowInfoWindow(false)}
                            style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                border: 'none',
                                background: '#fef2f2',
                                cursor: 'pointer',
                                color: '#ef4444',
                                fontSize: 14,
                                lineHeight: 1,
                                fontWeight: 600,
                            }}
                        >
                            ✕
                        </button>

                        <p style={{ fontWeight: 600, fontSize: 15, color: '#111827', margin: 0, paddingRight: 28 }}>
                            {selectedUser.profiles?.full_name ?? 'Unknown'}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: selectedUser.status === 'live' ? '#ecfdf5' : '#fef3c7',
                                color: selectedUser.status === 'live' ? '#059669' : '#b45309',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 999,
                                letterSpacing: '0.02em',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedUser.status === 'live' ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
                                {selectedUser.status === 'live' ? 'Live' : 'Last seen'}
                            </span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                {format(new Date(selectedUser.recorded_at), 'h:mm a')}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, color: '#374151', fontSize: 12 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#9ca3af' }}>
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>{selectedUser.placeName || 'Loading location...'}</span>
                        </div>
                    </div>
                </InfoWindow>
            )}
        </>
    );
}

export default function LiveMap(props: LiveMapProps) {
    return (
        <Mapcn>
            <LiveMapInner {...props} />
        </Mapcn>
    );
}
