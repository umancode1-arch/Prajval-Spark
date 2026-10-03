const DEMO_STORAGE_KEY = 'prajval_spark_demo_user';
const USERS_STORAGE_KEY = 'prajval_spark_demo_users';

export function getDemoUser() {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function setDemoUser(user) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user));
}

export function clearDemoUser() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEMO_STORAGE_KEY);
}

export function getDemoUsers() {
  if (typeof window === 'undefined') return [];

  const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

export function saveDemoUsers(users) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function demoSignUp({ email, password }) {
  const users = getDemoUsers();
  const existingUser = users.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    return {
      data: { user: null },
      error: { message: 'An account with this email already exists.' },
    };
  }

  const user = {
    id: `demo-${Date.now()}`,
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  const updatedUsers = [...users, user];
  saveDemoUsers(updatedUsers);
  setDemoUser({ id: user.id, email: user.email });

  return { data: { user: { id: user.id, email: user.email } }, error: null };
}

export function demoSignIn({ email, password }) {
  const users = getDemoUsers();
  const user = users.find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
  );

  if (!user) {
    return {
      data: { user: null },
      error: { message: 'Invalid email or password.' },
    };
  }

  const sessionUser = { id: user.id, email: user.email };
  setDemoUser(sessionUser);

  return { data: { user: sessionUser }, error: null };
}
