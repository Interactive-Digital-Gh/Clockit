import { NextResponse, type NextRequest } from "next/server"

// Gate routes on the presence of the API auth cookie. (Full validation happens
// on the API for every data call; this just keeps unauthenticated users out of
// the dashboard shell and signed-in users off /login.)
const TOKEN_COOKIE = "clockit_token"
// /kiosk is the front-desk QR display — it's meant to run on a screen that
// never logs in, so it stays outside the auth gate entirely.
const PUBLIC_ROUTES = ["/login", "/kiosk"]

export function proxy(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value
  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  if (!token && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (token && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
