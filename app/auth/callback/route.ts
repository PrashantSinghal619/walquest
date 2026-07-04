import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/map";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Exchange failed - link is expired, already used, or malformed.
  return NextResponse.redirect(
    new URL(
      "/auth/login?error=That+link%27s+gone+cold!+Pop+your+email+in+to+get+a+fresh+one.",
      origin
    )
  );
}
