import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { AdminRole, ROLE_PERMISSIONS } from '@/types';

// ============================================
// ADMIN USERS — loaded from the ADMIN_CREDENTIALS env var (JSON array).
// Never hardcode credentials in source.
// ============================================

interface AdminUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: AdminRole;
}

/**
 * ADMIN_CREDENTIALS is a JSON array of records:
 *   [{ "id": "1", "email": "...", "passwordHash": "$2a$12$...",
 *      "name": "...", "role": "super_admin" }, ...]
 * Set it in Vercel project env vars (Production + Preview).
 */
function loadAdminUsers(): AdminUserRecord[] {
  const raw = process.env.ADMIN_CREDENTIALS;
  if (!raw) {
    console.error('[auth] ADMIN_CREDENTIALS env var is not set — no admins can log in.');
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('ADMIN_CREDENTIALS must be a JSON array');
    }
    return parsed as AdminUserRecord[];
  } catch (e) {
    console.error('[auth] Failed to parse ADMIN_CREDENTIALS:', e);
    return [];
  }
}

const ADMIN_USERS = loadAdminUsers();

// ============================================
// NEXTAUTH CONFIGURATION
// ============================================

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = ADMIN_USERS.find(
          (u) => u.email.toLowerCase() === credentials.email.toLowerCase()
        );

        if (!user) {
          throw new Error('Invalid email or password');
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  callbacks: {
    async jwt({ token, user }) {
      // Add role to token on sign in
      if (user) {
        token.role = (user as unknown as { role: AdminRole }).role;
        token.id = user.id;
      }
      return token;
    },
    
    async session({ session, token }) {
      // Add role to session
      if (session.user) {
        (session.user as { role?: AdminRole; id?: string }).role = token.role as AdminRole;
        (session.user as { role?: AdminRole; id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  
  secret: process.env.NEXTAUTH_SECRET,
};

// ============================================
// PERMISSION HELPER
// ============================================

export function hasPermission(
  role: AdminRole,
  permission: keyof typeof ROLE_PERMISSIONS.super_admin
): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export function canAccessRoute(role: AdminRole, route: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  
  if (!permissions) return false;
  
  // Route-based access control
  const routePermissions: Record<string, keyof typeof permissions> = {
    '/dashboard': 'canViewDashboard',
    '/dashboard/fraud': 'canViewFraud',
    '/dashboard/users': 'canManageUsers',
    '/dashboard/financial': 'canViewFinancials',
    '/dashboard/health': 'canViewDashboard',
  };
  
  const requiredPermission = routePermissions[route];
  
  if (!requiredPermission) return true; // Allow if no specific permission required
  
  return permissions[requiredPermission];
}
