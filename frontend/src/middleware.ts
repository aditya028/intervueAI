import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/setup", "/brief", "/interview", "/review", "/history"];

// Routes only accessible when NOT authenticated
const AUTH_ROUTES = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the token cookie/header exists
  // Since we use localStorage (client-side), middleware can't directly check it.
  // Instead, we use a lightweight cookie that the auth context sets.
  const token = request.cookies.get("intervueai_auth")?.value;

  // Check if current path is protected
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // If accessing protected route without token cookie, redirect to login
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If accessing auth routes with token, redirect to setup
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/setup/:path*",
    "/brief/:path*",
    "/interview/:path*",
    "/review/:path*",
    "/history/:path*",
    "/login",
    "/register",
  ],
};
