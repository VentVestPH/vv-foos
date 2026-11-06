const KEY = 'foos.lastSsoEmail';

export function readLastSsoEmail(): string | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value !== null && value !== '' ? value : null;
  } catch {
    return null;
  }
}

export function rememberSsoEmail(email: string): void {
  try {
    window.localStorage.setItem(KEY, email);
  } catch {
    return;
  }
}

export function forgetSsoEmail(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    return;
  }
}
