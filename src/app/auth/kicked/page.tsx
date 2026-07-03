"use client";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function KickedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") || "SESSION_INVALID";

  useEffect(() => {
    signOut({ callbackUrl: `/login?error=${reason}` });
  }, [reason]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "monospace" }}>
      <p>Signing you out...</p>
    </div>
  );
}

export default function KickedPage() {
  return (
    <Suspense fallback={null}>
      <KickedContent />
    </Suspense>
  );
}
