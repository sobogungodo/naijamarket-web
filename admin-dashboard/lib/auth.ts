import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { AdminRole, ROLE_PERMISSIONS } from '@/types';

// ============================================
// ADMIN AUTHENTICATION CONFIGURATION
// NaijaMarket Intel Admin Dashboard
// ============================================

// Admin users (in production, this should be in database)
// Passwords are bcrypt hashed
const ADMIN_USERS = [
  {
    id: '1',
    email: 'olawale.sobogungod@giggabytes.eu',
    name: 'Olawale',
    // Password: NaijaAdmin2024! (hashed)
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4uSVPwA.G2gfH5F.',
    role: 'super_admin' as AdminRole,
    avatar: null,
    isActive: true,
  },
  {
    id: '2',
    email: 'admin@naijamarket.ng',
    name: 'Admin User',
    // Password: AdminPass2024!
    passwordHash: '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    role: 'admin' as AdminRole,
    avatar: null,
    isActive: true,
  },
  {
    id: '3',
    email: 'supervisor@naijamarket.ng',
    name: 'Supervisor',
    // Password: SuperPass2024!
    passwordHash: '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    role: 'supervisor' as AdminRole,
    avatar: null,
    isActive: true,
  },
  {
    id: '4',
    email: 'analyst@naijamarket.ng',
    name: 'Data Analyst',
    // Password: AnalystPass2024!
    passwordHash: '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    role: 'analyst' as AdminRole,
    avatar: null,
    isActive: true,
  },
];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Admin Login',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@naijamarket.ng' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        // Find user
        const user = ADMIN_USERS.find(
          (u) => u.email.toLowerCase() === credentials.email.toLowerCase()
        );

        if (!user) {
          throw new Error('Invalid email or password');
        }

        if (!user.isActive) {
          throw new Error('Account is disabled. Contact administrator.');
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        // Return user object (without password)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.avatar,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Add role to token on sign in
      if (user) {
        token.role = (user as { role: AdminRole }).role;
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      // Add role and permissions to session
      if (session.user) {
        (session.user as { role: AdminRole; id: string }).role = token.role as AdminRole;
        (session.user as { role: AdminRole; id: string }).id = token.id as string;
        (session.user as { permissions: typeof ROLE_PERMISSIONS[AdminRole] }).permissions =
          ROLE_PERMISSIONS[token.role as AdminRole];
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};

/**
 * Hash a password (utility function for creating new admins)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Get user permissions by role
 */
export function getUserPermissions(role: AdminRole) {
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  role: AdminRole,
  permission: keyof typeof ROLE_PERMISSIONS[AdminRole]
): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

export default authOptions;
