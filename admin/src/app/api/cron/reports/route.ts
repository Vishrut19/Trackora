import { supabaseServer } from '@/lib/supabase-server';
import { format } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'reports@resend.dev';

/** Get today's date string in IST (YYYY-MM-DD) for DB queries. */
function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Check if today (IST) is the last day of the month. */
function isLastDayOfMonthIST(): boolean {
  const today = new Date();
  const ist = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const tomorrow = new Date(ist);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return ist.getMonth() !== tomorrow.getMonth();
}

/** First and last date of current month in IST. */
function monthRangeIST(): { from: string; to: string } {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = ist.getFullYear();
  const m = ist.getMonth();
  const from = format(new Date(y, m, 1), 'yyyy-MM-dd');
  const lastDay = new Date(y, m + 1, 0);
  const to = format(lastDay, 'yyyy-MM-dd');
  return { from, to };
}

function escapeCsvField(val: unknown): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatHoursMinutes(totalMinutes: number | null | undefined): string {
  const mins = totalMinutes ?? 0;
  if (mins <= 0) return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

async function getAdminEmails(): Promise<string[]> {
  if (!supabaseServer) return [];
  const { data } = await supabaseServer
    .from('profiles')
    .select('email')
    .eq('role', 'admin')
    .eq('is_active', true);
  const emails = (data ?? []).map((r) => r.email).filter(Boolean) as string[];
  return emails;
}

async function getAttendanceRows(dateFrom: string, dateTo: string) {
  if (!supabaseServer) return [];
  const { data, error } = await supabaseServer
    .from('attendance')
    .select('*, profiles:user_id (full_name, email)')
    .gte('attendance_date', dateFrom)
    .lte('attendance_date', dateTo)
    .order('check_in_time', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function buildCsv(rows: any[]): string {
  const headers = [
    'Employee',
    'Email',
    'Date',
    'Check In Location',
    'Check Out Location',
    'Check In',
    'Check Out',
    'Total Time',
    'Status',
  ];
  const csvRows = rows.map((r) => [
    escapeCsvField(r.profiles?.full_name ?? ''),
    escapeCsvField(r.profiles?.email ?? ''),
    escapeCsvField(r.attendance_date),
    escapeCsvField(
      [r.check_in_city, r.check_in_state].filter(Boolean).join(', ') || '-'
    ),
    escapeCsvField(
      [r.check_out_city, r.check_out_state].filter(Boolean).join(', ') || '-'
    ),
    escapeCsvField(
      r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm:ss') : '-'
    ),
    escapeCsvField(
      r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm:ss') : '-'
    ),
    escapeCsvField(formatHoursMinutes(r.total_minutes)),
    escapeCsvField(r.status ?? ''),
  ]);
  const content = [headers.map(escapeCsvField), ...csvRows.map((row) => row.join(','))].join('\r\n');
  return '\uFEFF' + content;
}

function authorize(req: NextRequest): boolean {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
    ?? req.headers.get('x-cron-secret')
    ?? new URL(req.url).searchParams.get('secret');
  return !!CRON_SECRET && secret === CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json(
      { error: 'Server Supabase client not configured (SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 }
    );
  }

  const type = new URL(req.url).searchParams.get('type') ?? 'daily';
  const results: { daily?: string; monthly?: string } = {};

  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No admin emails to send to',
        results,
      });
    }

    const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

    // Daily report: today's attendance (IST)
    if (type === 'daily' || type === 'all') {
      const today = todayIST();
      const rows = await getAttendanceRows(today, today);
      const csv = buildCsv(rows);
      const filename = `attendance_daily_${today}.csv`;

      if (resend) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: adminEmails,
          subject: `WorkFlow Daily Attendance Report – ${today}`,
          attachments: [{ filename, content: Buffer.from(csv, 'utf-8') }],
        });
        results.daily = `sent to ${adminEmails.length} admin(s), ${rows.length} rows`;
      } else {
        results.daily = `skipped (no RESEND_API_KEY), ${rows.length} rows`;
      }
    }

    // Monthly report: only on last day of month (IST)
    const shouldRunMonthly = type === 'monthly' || type === 'all' || (type === 'daily' && isLastDayOfMonthIST());
    if (shouldRunMonthly) {
      const { from, to } = monthRangeIST();
      const rows = await getAttendanceRows(from, to);
      const csv = buildCsv(rows);
      const filename = `attendance_monthly_${from}_to_${to}.csv`;

      if (resend) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: adminEmails,
          subject: `WorkFlow Monthly Attendance Report – ${from} to ${to}`,
          attachments: [{ filename, content: Buffer.from(csv, 'utf-8') }],
        });
        results.monthly = `sent to ${adminEmails.length} admin(s), ${rows.length} rows`;
      } else {
        results.monthly = `skipped (no RESEND_API_KEY), ${rows.length} rows`;
      }
    }

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (err) {
    console.error('Cron reports error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
