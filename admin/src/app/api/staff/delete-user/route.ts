import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const userId = typeof body?.userId === "string" ? body.userId.trim() : null;
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const missing: string[] = [];
    if (!url?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!anonKey?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!serviceRoleKey?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missing.length > 0) {
      console.error("[delete-user] Missing env:", missing.join(", "));
      return NextResponse.json(
        {
          error: `Server misconfiguration: add ${missing.join(", ")} in Vercel → Project Settings → Environment Variables.`,
        },
        { status: 500 },
      );
    }

    const supabaseUrl = url as string;
    const supabaseAnonKey = anonKey as string;
    const supabaseServiceRoleKey = serviceRoleKey as string;

    const anon = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user: caller },
      error: authError,
    } = await anon.auth.getUser(token);
    if (authError || !caller) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 },
      );
    }

    const { data: profile } = await anon
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: admin only" },
        { status: 403 },
      );
    }

    if (caller.id === userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Auth delete error:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete user from auth" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete user API error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
