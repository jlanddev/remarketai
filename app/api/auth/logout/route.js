import { NextResponse } from 'next/server';

export async function POST(request) {
  // Create response and clear session cookie
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully'
  });

  response.cookies.delete('remarket_session');

  return response;
}
