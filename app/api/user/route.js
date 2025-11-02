import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  const user = await getCurrentUser();

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
