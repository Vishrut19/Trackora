'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Loader } from '@/components/ui/loader';
import { Map as MapIcon, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

// Dynamically import the map component because Leaflet needs 'window' (client-side only)
const LiveMap = dynamic(() => import('@/components/LiveMap'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center w-full h-[600px] bg-muted/50 rounded-2xl border border-border">
            <Loader size="lg" />
        </div>
    )
});

export default function MapPage() {
    const [activeUserCount, setActiveUserCount] = useState<number | null>(null);

    return (
        <DashboardLayout>
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-foreground flex items-center">
                        <MapIcon className="mr-3 text-destructive" />
                        Live Team Distribution
                    </h2>
                    <p className="text-muted-foreground mt-1">See where your employees are in real-time</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-muted border border-border px-4 py-2 rounded-xl flex items-center shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-2"></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Real-time polling active</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 h-[600px]">
                    <LiveMap onLocationsUpdated={setActiveUserCount} />
                </div>

                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-foreground mb-4 flex items-center">
                            <Users size={18} className="mr-2 text-primary" />
                            Quick Info
                        </h3>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li className="flex justify-between border-b border-border pb-2">
                                <span>Active Users</span>
                                <span className="text-foreground font-bold">{activeUserCount !== null ? activeUserCount : '---'}</span>
                            </li>
                            <li className="flex justify-between border-b border-border pb-2">
                                <span>Last Updated</span>
                                <span className="text-foreground font-bold">Just now</span>
                            </li>
                            <li className="flex justify-between">
                                <span>Accuracy</span>
                                <span className="text-green-500 font-bold">High (GPS)</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6">
                        <h3 className="font-bold text-primary mb-2">Usage Tip</h3>
                        <p className="text-xs text-muted-foreground leading-5">
                            Click on any marker to see the employee's name and their last recorded timestamp. The map updates automatically every 60 seconds.
                        </p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
