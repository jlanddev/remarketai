import { cookies } from 'next/headers';

export async function getCurrentUser() {
  try {
    const sessionCookie = cookies().get('remarket_session');

    if (!sessionCookie) {
      return null;
    }

    const session = JSON.parse(sessionCookie.value);
    return session;
  } catch {
    return null;
  }
}

export function requireAuth() {
  const user = getCurrentUser();

  if (!user) {
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    };
  }

  return { props: { user } };
}
