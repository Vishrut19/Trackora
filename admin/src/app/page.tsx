'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import {
  Clock,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Users
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { Loader } from '@/components/ui/loader';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full min-h-[300px] bg-muted/50">
      <Loader size="lg" />
    </div>
  )
});

export default function DashboardHome() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeCheckins: 0,
    managedTeams: 0,
    unauthorizedDevices: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

        const today = new Date().toISOString().split('T')[0];
        const { count: activeCount } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('attendance_date', today)
          .is('check_out_time', null);

        const { count: teamsCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });

        const { count: deviceCount } = await supabase
          .from('user_devices')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', false); // Changed from is_authorized to is_active based on previous schema knowledge

        setStats({
          totalUsers: usersCount || 0,
          activeCheckins: activeCount || 0,
          managedTeams: teamsCount || 0,
          unauthorizedDevices: deviceCount || 0
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const statCards = [
    { name: 'Total Employees', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: 'Currently On Duty', value: stats.activeCheckins, icon: Clock, color: 'text-green-500', bg: 'bg-green-500/10' },
    { name: 'Managed Teams', value: stats.managedTeams, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { name: 'Inactive Devices', value: stats.unauthorizedDevices, icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-500/10' },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8 ml-1">
        <h2 className="text-4xl font-extrabold tracking-tight text-foreground">System Overview</h2>
        <p className="text-muted-foreground mt-2 font-medium">Real-time status of your staff and operations</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className="overflow-hidden border-border bg-card shadow-md transition-all duration-200 hover:shadow-lg hover:border-primary/30 group">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {stat.name}
              </CardTitle>
              <div className={`${stat.bg} ${stat.color} flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-transform duration-200 group-hover:scale-105`}>
                <stat.icon size={20} strokeWidth={2} />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-end justify-between gap-2">
                <div className="min-h-9">
                  {loading ? (
                    <Loader size="sm" className="h-9" />
                  ) : (
                    <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                      {stat.value}
                    </span>
                  )}
                </div>
                {!loading && (
                  <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Live
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden border-border bg-card shadow-md gap-0 py-0">
          <CardHeader className="border-b border-border/80 bg-muted/30 px-5 py-3">
            <CardTitle className="flex items-center gap-3 text-base font-semibold text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users size={18} />
              </span>
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-10 px-5">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border/50">
                <Clock size={28} className="text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-center text-sm font-medium text-foreground">No recent check-ins today</p>
              <p className="mt-1 text-center text-xs text-muted-foreground">Check-ins will appear here as staff clock in</p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden border-border bg-card shadow-md h-full gap-0 py-0">
          <CardHeader className="border-b border-border/80 bg-muted/30 px-5 py-3">
            <CardTitle className="flex items-center gap-3 text-base font-semibold text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <MapPin size={18} />
              </span>
              Team Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="relative min-h-[280px] flex-1 p-0">
            <LiveMap />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
