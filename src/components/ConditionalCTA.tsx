"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import WhatsAppCTA from "./WhatsAppCTA";

/**
 * Marketing CTAs (WhatsApp price check + reporter signup) belong only on the
 * public marketing site — not inside the authenticated dashboard. Hide them when
 * the user is signed in or on any /dashboard route.
 *
 * Must be rendered INSIDE the NextAuth SessionProvider (<Providers>) so
 * useSession() resolves correctly.
 */
export default function ConditionalCTA() {
  const { status } = useSession();
  const pathname = usePathname();

  if (status === "authenticated" || pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <>
      <WhatsAppCTA />
      <WhatsAppCTA variant="reporter" message="reporter" label="Register as Price Reporter" />
    </>
  );
}
