import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ error: "Gagal mengakhiri sesi" }, { status: 500 });

  return NextResponse.json({ success: true });
}