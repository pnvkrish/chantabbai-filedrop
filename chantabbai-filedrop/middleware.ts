import { NextResponse } from 'next/server'

// Auth is now handled client-side via localStorage — no server middleware needed
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
