import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { AdminRole, ROLE_PERMISSIONS } from '@/types';

// ============================================
// ADMIN USERS (In production, use database)
// ============================================

interface AdminUserRecord {
  id: string;
  email: string;
  password: string;
  name: string;
  role: AdminRole;
}

const ADMIN_USERS: AdminUserRecord[] = [
  {
    id: '1',
    email: 'olawale.sobogungodo@giggabytes.eu',
    password: 'NaijaAdmin2024!',
    name: 'Olawale Sobogungodo',
    role: 'super_admin',
  },
  {
    id: '2',
    email: 'admin@naijamarket.ng',
    password: 'AdminPass2024!',
    name: 'Admin User',
    role: 'admin',
  },
  {
    id: '3',
    email: 'supervisor@naijamarket.ng',
    password: 'SuperPass2024!',
    name: 'Supervisor User',
    role: 'supervisor',
  },
  {
    id: '4',
    email: 'analyst@naijamarket.ng',
    password: 'AnalystPass2024!',
    name: 'Analyst User',
    role: 'analyst',
  },
];

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

        // In production, use bcrypt.compare
        if (user.password !== credentials.password) {
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
