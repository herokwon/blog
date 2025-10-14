import { type NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { supabaseConfig } from './config';

const PROTECTED_ROUTES = ['/write'];
const AUTH_ROUTES = ['/login'];
const DEFAULT_REDIRECT = '/';

const isValidRedirectPath = (path: string): boolean =>
  path.startsWith('/') && !AUTH_ROUTES.some(route => path.startsWith(route));

export async function updateSession(request: NextRequest) {
  let supabaseResponse: NextResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const url = request.nextUrl.clone();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && AUTH_ROUTES.some(route => pathname.startsWith(route))) {
    const redirectTo = url.searchParams.get('redirect');

    if (redirectTo && isValidRedirectPath(redirectTo)) {
      url.pathname = redirectTo;
      url.searchParams.delete('redirect');

      return NextResponse.redirect(url);
    }

    url.pathname = DEFAULT_REDIRECT;
    return NextResponse.redirect(url);
  }

  if (!user && PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
