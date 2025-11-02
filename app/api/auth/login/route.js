import { NextResponse } from 'next/server';
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

// Simple password hashing (must match signup)
function hashPassword(password) {
  return Buffer.from(password).toString('base64');
}

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password required'
      }, { status: 400 });
    }

    // Load users from Netlify Blobs
    const users = await getUsers();

    // Find user
    const user = users.get(email);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email or password'
      }, { status: 401 });
    }

    // Check password
    if (user.password !== hashPassword(password)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email or password'
      }, { status: 401 });
    }

    console.log(`✅ User logged in: ${email}`);

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        company: user.company,
        clientId: user.clientId,
        apiKey: user.apiKey
      }
    });

    // Set session cookie
    response.cookies.set('remarket_session', JSON.stringify({
      userId: user.id,
      email: user.email,
      clientId: user.clientId
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
