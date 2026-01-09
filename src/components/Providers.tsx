// src/components/Providers.tsx
// NextAuth Session Provider Wrapper

"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
