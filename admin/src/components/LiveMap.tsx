'use client';

import { Loader } from '@/components/ui/loader';
import { Mapcn } from '@/components/ui/map';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Marker, Popup } from 'react-map-gl/maplibre';

interface LiveMapProps {
    onLocationsUpdated?: (count: number) => void;
}

export default function LiveMap({ onLocationsUpdated }: LiveMapProps) {
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<any | null>(null);

    useEffect(() => {
        loadLocations();
        const interval = setInterval(loadLocations, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    async function loadLocations() {
        try {
            // Get latest location logs for all users from the last 30 minutes
            const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();

            const { data: logs, error } = await supabase
                .from('location_logs')
                .select(`
          user_id,
          latitude,
          longitude,
          recorded_at,
          profiles:user_id (full_name)
        `)
                .gte('recorded_at', thirtyMinsAgo)
                .order('recorded_at', { ascending: false });

            if (error) throw error;

            // Group by user and take only the latest
            const uniqueLocations: any[] = [];
            const processedUsers = new Set();

            logs?.forEach(log => {
                if (!processedUsers.has(log.user_id)) {
                    processedUsers.add(log.user_id);
                    uniqueLocations.push(log);
                }
            });

            setLocations(uniqueLocations);
            if (onLocationsUpdated) {
                onLocationsUpdated(uniqueLocations.length);
            }
        } catch (error) {
            console.error('Error loading locations:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading && locations.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-muted/50 rounded-2xl border border-border">
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <Mapcn>
            {locations.map((loc) => (
                <Fragment key={loc.user_id}>
                    <Marker
                        latitude={loc.latitude}
                        longitude={loc.longitude}
                        onClick={e => {
                            e.originalEvent.stopPropagation();
                            setSelectedUser(loc);
                        }}
                    >
                        <div className="cursor-pointer group">
                            <div className="bg-destructive text-destructive-foreground p-1 rounded-full shadow-lg border-2 border-background group-hover:scale-110 transition-transform">
                                <MapPin size={16} />
                            </div>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-1 bg-popover text-popover-foreground text-[10px] px-2 py-0.5 rounded border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md">
                                {loc.profiles?.full_name}
                            </div>
                        </div>
                    </Marker>
                    {selectedUser?.user_id === loc.user_id && (
                        <Popup
                            latitude={loc.latitude}
                            longitude={loc.longitude}
                            anchor="top"
                            onClose={() => setSelectedUser(null)}
                            closeButton={false}
                            className="z-50"
                        >
                            <div className="p-2 min-w-[150px] bg-popover text-popover-foreground rounded-lg shadow-2xl border border-border">
                                <div className="font-bold text-sm border-b border-border pb-1 mb-2">
                                    {loc.profiles?.full_name}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-muted-foreground">Last Seen:</span>
                                        <span className="text-primary font-mono">
                                            {format(new Date(loc.recorded_at), 'hh:mm a')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-muted-foreground">Status:</span>
                                        <span className="text-green-500 flex items-center gap-1 font-bold italic">
                                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                            ACTIVE
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    )}
                </Fragment>
            ))}
        </Mapcn>
    );
}
