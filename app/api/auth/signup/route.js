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

// Save users to Netlify Blobs
async function saveUsers(users) {
  try {
    const store = getStore('attrios-users');
    const usersArray = Array.from(users.values());
    await store.set('all-users', JSON.stringify(usersArray));
    console.log(`✅ Saved ${users.size} users to Netlify Blobs`);
  } catch (error) {
    console.error('Error saving users to Netlify Blobs:', error);
  }
}

// Simple password hashing (use bcrypt in production)
function hashPassword(password) {
  // For demo: just reverse it (USE BCRYPT IN PRODUCTION!)
  return Buffer.from(password).toString('base64');
}

export async function POST(request) {
  try {
    const { email, password, name, company, website } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password required'
      }, { status: 400 });
    }

    if (!website) {
      return NextResponse.json({
        success: false,
        error: 'Website URL required for AI analysis'
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: 'Password must be at least 6 characters'
      }, { status: 400 });
    }

    // Load existing users
    const users = await getUsers();

    // Check if user exists
    if (users.has(email)) {
      return NextResponse.json({
        success: false,
        error: 'Email already registered'
      }, { status: 400 });
    }

    // Create user
    const userId = 'usr_' + Math.random().toString(36).substr(2, 9) + Date.now();
    const clientId = 'client_' + Math.random().toString(36).substr(2, 12);

    const user = {
      id: userId,
      clientId,
      email,
      password: hashPassword(password),
      name: name || email.split('@')[0],
      company: company || '',
      website: website,
      createdAt: new Date().toISOString(),
      apiKey: 'sk_' + Math.random().toString(36).substr(2, 32)
    };

    users.set(email, user);
    await saveUsers(users); // Persist to Netlify Blobs

    console.log(`✅ New user registered: ${email} (client_id: ${clientId})`);

    // Trigger business analysis (async - don't wait for it)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze-business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        websiteUrl: website,
        companyName: company || name || email.split('@')[0]
      })
    }).catch(err => console.error('Business analysis failed:', err));

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
    console.error('Signup error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
