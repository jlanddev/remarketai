import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Persistent storage file
const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');

// In-memory user storage (synced with file)
const users = new Map();

// Load users from file on startup
function loadUsers() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const usersArray = JSON.parse(data);
      usersArray.forEach(user => {
        users.set(user.email, user);
      });
      console.log(`✅ Loaded ${users.size} users from disk`);
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Save users to file
function saveUsers() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const usersArray = Array.from(users.values());
    fs.writeFileSync(DATA_FILE, JSON.stringify(usersArray, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

// Load users on module import
loadUsers();

// Simple password hashing (use bcrypt in production)
function hashPassword(password) {
  // For demo: just reverse it (USE BCRYPT IN PRODUCTION!)
  return Buffer.from(password).toString('base64');
}

export async function POST(request) {
  try {
    const { email, password, name, company } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password required'
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: 'Password must be at least 6 characters'
      }, { status: 400 });
    }

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
      createdAt: new Date().toISOString(),
      apiKey: 'sk_' + Math.random().toString(36).substr(2, 32)
    };

    users.set(email, user);
    saveUsers(); // Persist to disk

    console.log(`✅ New user registered: ${email} (client_id: ${clientId})`);

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

// Export users map for other routes to access
export { users };
