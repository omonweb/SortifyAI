"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: fullName.trim() });
      router.replace("/dashboard");
    } catch (err) {
      setError(getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSignup();
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px",
    background: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 10, fontSize: 14, color: "#1c1c2e",
    outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", transition: "border-color 0.2s"
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: "linear-gradient(135deg, #c8d8f0 0%, #ddd6f3 45%, #f0e6f6 75%, #fce8e4 100%)" }}>

      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-full"
               style={{ background: "radial-gradient(circle at 35% 35%, #f4a58a, #e85d4a 60%, #c0392b)", boxShadow: "0 4px 14px rgba(232,93,74,0.4)" }} />
          <span style={{ fontFamily: "var(--font-syne)", fontSize: 22, fontWeight: 700, color: "#1c1c2e", letterSpacing: "-0.4px" }}>
            SortifyAI
          </span>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.78)",
          borderRadius: 20,
          boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
          padding: "36px 32px"
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c1c2e", marginBottom: 4 }}>
            Create your account
          </h1>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 28 }}>
            Set up your SortifyAI recruiter workspace
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {[
              { label: "Full Name", type: "text", value: fullName, set: setFullName, placeholder: "Aarav Arora" },
              { label: "Email", type: "email", value: email, set: setEmail, placeholder: "you@company.com" },
              { label: "Password", type: "password", value: password, set: setPassword, placeholder: "Min. 6 characters" },
              { label: "Confirm Password", type: "password", value: confirm, set: setConfirm, placeholder: "Re-enter password" },
            ].map(({ label, type, value, set, placeholder }) => (
              <div key={label}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", letterSpacing: "0.4px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "#e85d4a"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(0,0,0,0.08)"}
                />
              </div>
            ))}

            {error && (
              <p style={{ fontSize: 12, color: "#e85d4a", background: "rgba(232,93,74,0.08)", padding: "8px 12px", borderRadius: 8 }}>
                {error}
              </p>
            )}

            <button
              onClick={handleSignup}
              disabled={loading}
              style={{
                marginTop: 8, width: "100%", padding: "11px",
                background: loading ? "rgba(232,93,74,0.5)" : "#e85d4a",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit", transition: "background 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}
            >
              {loading && (
                <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              )}
              {loading ? "Creating account..." : "Create account"}
            </button>

          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#9ca3af" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#e85d4a", fontWeight: 500, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function getFriendlyError(code) {
  const map = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password is too weak.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
