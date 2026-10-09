const STORAGE_KEY = 'prajval_spark_attempt_history';

export function getAttemptHistory(email) {
  if (typeof window === 'undefined' || !email) return [];
  const allHistory = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  return Array.isArray(allHistory[email.toLowerCase()]) ? allHistory[email.toLowerCase()] : [];
}

export function saveAttempt(email, attempt) {
  if (typeof window === 'undefined' || !email) {
    throw new Error('Sign in to save your mock test results.');
  }

  const allHistory = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  const key = email.toLowerCase();
  allHistory[key] = [attempt, ...(Array.isArray(allHistory[key]) ? allHistory[key] : [])].slice(0, 50);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(allHistory));
}
