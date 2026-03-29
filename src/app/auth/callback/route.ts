import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Check if user_profiles row exists for this user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        // If YES and role is set → redirect to /dashboard
        if (profile?.role) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        } else {
          // If NO or role is null → redirect to /onboarding
          return NextResponse.redirect(new URL('/onboarding', request.url));
        }
      }
    }
  }

  // Fallback
  return NextResponse.redirect(new URL('/onboarding', request.url));
}
