import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request) {
  // Get current user from cookie
  let user = null;
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('remarket_session');
    if (sessionCookie) {
      user = JSON.parse(sessionCookie.value);
    }
  } catch (error) {
    console.error('Error reading session:', error);
  }

  if (!user) {
    return NextResponse.json({
      success: false,
      error: 'Not authenticated'
    }, { status: 401 });
  }

  // Get full user data
  let users;
  try {
    const signupModule = await import('../auth/signup/route.js');
    users = signupModule.users;
  } catch {
    return NextResponse.json({
      success: false,
      error: 'User data not available'
    }, { status: 500 });
  }

  const userData = users.get(user.email);

  if (!userData) {
    return NextResponse.json({
      success: false,
      error: 'User not found'
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      company: userData.company,
      clientId: userData.clientId,
      apiKey: userData.apiKey,
      createdAt: userData.createdAt
    }
  });
}
