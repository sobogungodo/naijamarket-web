"use client";

import { SessionProvider } from "next-auth/react";
import { SessionTimeoutProvider } from "./SessionTimeoutProvider";

interface AuthSessionWrapperProps {
  children: React.ReactNode;
}

/**
 * AuthSessionWrapper
 * 
 * Combines NextAuth SessionProvider with custom SessionTimeoutProvider.
 * Use this in your root layout to enable:
 * - NextAuth session management
 * - Automatic session timeout after 5 minutes of inactivity
 * - Warning modal 1 minute before timeout
 * 
 * Usage in layout.tsx:
 * 
 * import { AuthSessionWrapper } from "@/components/AuthSessionWrapper";
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <AuthSessionWrapper>
 *           {children}
 *         </AuthSessionWrapper>
 *       </body>
 *     </html>
 *   );
 * }
 */
export function AuthSessionWrapper({ children }: AuthSessionWrapperProps) {
  return (
    <SessionProvider>
      <SessionTimeoutProvider>
        {children}
      </SessionTimeoutProvider>
    </SessionProvider>
  );
}

export default AuthSessionWrapper;
