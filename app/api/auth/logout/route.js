import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  // Clear session cookie
  cookies().delete('remarket_session');

  return NextResponse.json({
    success: true,
    message: 'Logged out successfully'
  });
}
