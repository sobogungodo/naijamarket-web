"use client";

import { useState, FormEvent } from "react";

// ============================================================================
// EmailSignup — Landing page mailing list capture component
// Deploy to: src/components/EmailSignup.tsx
// Usage: <EmailSignup /> — drop into any page
// ============================================================================

interface EmailSignupProps {
  variant?: "hero" | "footer" | "inline";
  source?: string;
}

export default function EmailSignup({ variant = "hero", source = "landing_page" }: EmailSignupProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "exists">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          source,
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.alreadySubscribed) {
          setStatus("exists");
          setMessage("You're already subscribed! Check your inbox.");
        } else {
          setStatus("success");
          setMessage(data.message || "You're in! Check your inbox.");
          setEmail("");
          setFirstName("");
        }
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  const isCompact = variant === "footer" || variant === "inline";

  // Success state
  if (status === "success") {
    return (
      <>
        <style>{SIGNUP_STYLES}</style>
        <div className={`nms-wrap nms-${variant}`}>
          <div className="nms-success">
            <div className="nms-success-icon">✉️</div>
            <div className="nms-success-title">Welcome aboard!</div>
            <div className="nms-success-msg">{message}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{SIGNUP_STYLES}</style>
      <div className={`nms-wrap nms-${variant}`}>
        {!isCompact && (
          <div className="nms-header">
            <h3 className="nms-title">Get Free Weekly Market Briefs</h3>
            <p className="nms-subtitle">
              610+ commodity prices across 37 states — delivered to your inbox every Monday.
            </p>
          </div>
        )}
        {isCompact && (
          <div className="nms-header">
            <h3 className="nms-title-sm">Get Weekly Market Briefs</h3>
          </div>
        )}

        <form onSubmit={handleSubmit} className="nms-form">
          <div className={`nms-fields ${isCompact ? "nms-fields-row" : ""}`}>
            {!isCompact && (
              <input
                type="text"
                placeholder="First name (optional)"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="nms-input"
                maxLength={100}
                disabled={status === "loading"}
              />
            )}
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error" || status === "exists") setStatus("idle");
              }}
              className="nms-input"
              required
              maxLength={255}
              disabled={status === "loading"}
            />
            <button
              type="submit"
              className="nms-btn"
              disabled={status === "loading" || !email.trim()}
            >
              {status === "loading" ? (
                <span className="nms-spinner" />
              ) : isCompact ? (
                "Subscribe"
              ) : (
                "Subscribe — It's Free"
              )}
            </button>
          </div>

          {(status === "error" || status === "exists") && (
            <div className={`nms-msg ${status === "exists" ? "nms-msg-info" : "nms-msg-err"}`}>
              {message}
            </div>
          )}

          <div className="nms-footer-text">
            <span className="nms-lock">🔒</span>
            No spam. Unsubscribe anytime.{" "}
            {!isCompact && "NDPR & GDPR compliant."}
          </div>
        </form>
      </div>
    </>
  );
}

const SIGNUP_STYLES = `
.nms-wrap {
  width: 100%;
  max-width: 520px;
}
.nms-hero { margin: 0 auto; }
.nms-footer { margin: 0; }
.nms-inline { margin: 0 auto; }

.nms-header { margin-bottom: 16px; }
.nms-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 6px;
  letter-spacing: -0.5px;
}
.nms-title-sm {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 10px;
}
.nms-subtitle {
  font-size: 14px;
  color: #94A3B8;
  margin: 0;
  line-height: 1.5;
}

.nms-form { display: flex; flex-direction: column; gap: 10px; }

.nms-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nms-fields-row {
  flex-direction: row !important;
}

.nms-input {
  flex: 1;
  padding: 12px 14px;
  background: #111820;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  color: #E2E8F0;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
  min-width: 0;
}
.nms-input::placeholder { color: #475569; }
.nms-input:focus { border-color: #00C853; }
.nms-input:disabled { opacity: 0.6; }

.nms-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #00C853, #00E676);
  color: #0A0F14;
  font-size: 14px;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
  white-space: nowrap;
  font-family: inherit;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nms-btn:hover:not(:disabled) { transform: translateY(-1px); }
.nms-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.nms-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(10,15,20,0.3);
  border-top-color: #0A0F14;
  border-radius: 50%;
  animation: nms-spin 0.6s linear infinite;
}
@keyframes nms-spin { to { transform: rotate(360deg); } }

.nms-msg {
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
}
.nms-msg-err {
  background: rgba(239,68,68,0.1);
  color: #EF4444;
  border: 1px solid rgba(239,68,68,0.2);
}
.nms-msg-info {
  background: rgba(0,200,83,0.08);
  color: #00C853;
  border: 1px solid rgba(0,200,83,0.15);
}

.nms-footer-text {
  font-size: 11px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 4px;
}
.nms-lock { font-size: 12px; }

/* Success state */
.nms-success {
  text-align: center;
  padding: 28px 20px;
  background: rgba(0,200,83,0.04);
  border: 1px solid rgba(0,200,83,0.15);
  border-radius: 14px;
}
.nms-success-icon { font-size: 36px; margin-bottom: 12px; }
.nms-success-title {
  font-size: 18px;
  font-weight: 700;
  color: #00C853;
  margin-bottom: 6px;
}
.nms-success-msg {
  font-size: 14px;
  color: #94A3B8;
}

@media (min-width: 640px) {
  .nms-fields-row .nms-input { flex: 2; }
  .nms-fields-row .nms-btn { flex: 0 0 auto; }
}
`;
