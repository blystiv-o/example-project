import { type NextRequest, NextResponse } from 'next/server';

const privatePaths = ['/dashboard', '/expenses', '/categories', '/profile'];

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  try {
    const response = await fetch(`${apiOrigin}/api/v1/auth/me`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const authenticated = await hasValidSession(request);

  if (pathname === '/login') {
    return authenticated
      ? NextResponse.redirect(new URL('/dashboard', request.url))
      : NextResponse.next();
  }
  if (privatePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    if (!authenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnTo', `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/expenses/:path*',
    '/categories/:path*',
    '/profile/:path*',
  ],
};
