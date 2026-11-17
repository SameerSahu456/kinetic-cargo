import { AuthSession, UserAccount } from '../types/invoice';

const STORAGE_ACCOUNTS_KEY = 'kinetic_cargo_accounts_v1';
const STORAGE_SESSION_KEY = 'kinetic_cargo_session_v1';

export const DEMO_OPERATOR_EMAIL = 'ops@kineticcargo.in';
export const DEMO_OPERATOR_PASSWORD = 'Kinetic@2026';

export async function hashPassword(password: string, emailSalt: string): Promise<string> {
  const normalized = `${emailSalt.trim().toLowerCase()}::${password}`;
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function writeAccounts(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage errors
  }
}

export async function ensureDefaultAccount(): Promise<UserAccount[]> {
  const existing = readAccounts();
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  const demoHash = await hashPassword(DEMO_OPERATOR_PASSWORD, DEMO_OPERATOR_EMAIL);
  const seeded: UserAccount = {
    id: 'usr-demo-ops',
    fullName: 'Aarav Mehta',
    email: DEMO_OPERATOR_EMAIL,
    role: 'Finance & Billing Lead',
    passwordHash: demoHash,
    createdAt: now,
    lastLoginAt: now,
  };
  writeAccounts([seeded]);
  return [seeded];
}

export function getCurrentSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthSession;
      if (parsed && parsed.userId && parsed.email) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveSession(session: AuthSession | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function signInWithCredentials(
  email: string,
  password: string
): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }> {
  const accounts = await ensureDefaultAccount();
  const normalizedEmail = email.trim().toLowerCase();
  const account = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
  if (!account) {
    return { ok: false, error: 'No workspace account found for that email address.' };
  }

  const candidateHash = await hashPassword(password, normalizedEmail);
  if (candidateHash !== account.passwordHash) {
    return { ok: false, error: 'Incorrect password. Please check your credentials and try again.' };
  }

  const now = new Date().toISOString();
  const updatedAccounts = accounts.map((a) =>
    a.id === account.id ? { ...a, lastLoginAt: now } : a
  );
  writeAccounts(updatedAccounts);

  const session: AuthSession = {
    userId: account.id,
    fullName: account.fullName,
    email: account.email,
    role: account.role,
    signedInAt: now,
  };
  saveSession(session);
  return { ok: true, session };
}

export async function registerWorkspaceAccount(params: {
  fullName: string;
  email: string;
  role: string;
  password: string;
}): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }> {
  const fullName = params.fullName.trim();
  const normalizedEmail = params.email.trim().toLowerCase();
  const role = params.role.trim() || 'Authorized Operator';
  const password = params.password;

  if (!fullName) {
    return { ok: false, error: 'Please enter your full name.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: 'Please enter a valid work email address.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters long.' };
  }

  const accounts = await ensureDefaultAccount();
  if (accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
    return { ok: false, error: 'An account with this email already exists. Please sign in.' };
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password, normalizedEmail);
  const newAccount: UserAccount = {
    id: `usr-${Date.now()}`,
    fullName,
    email: normalizedEmail,
    role,
    passwordHash,
    createdAt: now,
    lastLoginAt: now,
  };

  writeAccounts([newAccount, ...accounts]);

  const session: AuthSession = {
    userId: newAccount.id,
    fullName: newAccount.fullName,
    email: newAccount.email,
    role: newAccount.role,
    signedInAt: now,
  };
  saveSession(session);
  return { ok: true, session };
}

export function updateProfileSession(
  userId: string,
  patch: { fullName: string; role: string }
): AuthSession | null {
  const accounts = readAccounts();
  const updatedAccounts = accounts.map((a) =>
    a.id === userId
      ? {
          ...a,
          fullName: patch.fullName.trim() || a.fullName,
          role: patch.role.trim() || a.role,
        }
      : a
  );
  writeAccounts(updatedAccounts);

  const current = getCurrentSession();
  if (current && current.userId === userId) {
    const nextSession: AuthSession = {
      ...current,
      fullName: patch.fullName.trim() || current.fullName,
      role: patch.role.trim() || current.role,
    };
    saveSession(nextSession);
    return nextSession;
  }
  return current;
}

export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters.' };
  }
  const accounts = readAccounts();
  const account = accounts.find((a) => a.id === userId);
  if (!account) {
    return { ok: false, error: 'Account record not found.' };
  }

  const currentHash = await hashPassword(currentPassword, account.email);
  if (currentHash !== account.passwordHash) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  const nextHash = await hashPassword(newPassword, account.email);
  writeAccounts(
    accounts.map((a) => (a.id === userId ? { ...a, passwordHash: nextHash } : a))
  );
  return { ok: true };
}

export function signOutWorkspace(): void {
  saveSession(null);
}
