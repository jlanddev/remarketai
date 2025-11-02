import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStore } from '@netlify/blobs';

// Get users from Netlify Blobs
async function getUsers() {
  try {
    const store = getStore('attrios-users');
    const usersData = await store.get('all-users');

    if (!usersData) {
      return new Map();
    }

    const usersArray = JSON.parse(usersData);
    const users = new Map();
    usersArray.forEach(user => {
      users.set(user.email, user);
    });

    return users;
  } catch (error) {
    console.error('Error loading users from Netlify Blobs:', error);
    return new Map();
  }
}

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

  // Get full user data from Netlify Blobs
  const users = await getUsers();
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
