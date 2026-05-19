import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/login') return NextResponse.next();

  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico');

  if (isPublic) return NextResponse.next();

  const PRIVATE_PATHS = ['/dashboard', '/admin'];
  const isPrivate = PRIVATE_PATHS.some(p => pathname.startsWith(p));

  if (isPrivate) {
    // Session lives in localStorage — middleware cannot read it on the Edge.
    // Auth gating is enforced client-side by AuthContext + DashboardLayout.
    // Only redirect if a server-readable session cookie is present in future.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
