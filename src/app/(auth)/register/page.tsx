"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { ShoppingBag, GraduationCap, Store, ArrowLeft, Eye, EyeOff, Check, Loader2 } from "lucide-react"

type Step = "role" | "form" | "confirm"
type Role = "student" | "vendor"

export default function RegisterPage() {
  const supabase = createClient()

  const [step, setStep] = useState<Step>("role")
  const [role, setRole] = useState<Role | null>(null)
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const passwordStrength = (p: string) => {
    if (p.length === 0) return 0
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  }

  const strength = passwordStrength(form.password)
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength]
  const strengthColor = ["", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e"][strength]

  const handleGoogleSignUp = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` },
    })
  }

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all fields.")
      return
    }
    if (strength < 2) {
      setError("Please choose a stronger password.")
      return
    }
    setLoading(true)
    setError("")

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.name, role },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // Supabase returns a fake success for existing emails — detect it this way
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("An account with this email already exists. Try logging in instead.")
      return
    }

    setStep("confirm")
  }

  return (
    <>
      <style>{`
        .reg-page {
          min-height: 100dvh;
          background: #f5f7ff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
        }
        .dark .reg-page { background: #060d1f; }

        .reg-logo {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 32px;
          text-decoration: none;
        }
        .reg-logo-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: #2563eb;
          display: flex; align-items: center; justify-content: center;
        }
        .reg-logo-text {
          font-family: var(--font-sora), Sora, sans-serif;
          font-size: 20px; font-weight: 700;
          color: #0f172a;
        }
        .dark .reg-logo-text { color: #f1f5f9; }
        .reg-logo-text span { color: #2563eb; }

        .reg-card {
          width: 100%; max-width: 420px;
          background: white; border-radius: 24px;
          border: 1.5px solid #e2e8f0;
          padding: 32px 28px;
          box-shadow: 0 4px 24px rgba(37,99,235,0.06);
        }
        .dark .reg-card { background: #0f1a35; border-color: #1e3a5f; }

        .reg-title {
          font-family: var(--font-sora), Sora, sans-serif;
          font-size: 22px; font-weight: 700;
          color: #0f172a; margin-bottom: 6px; text-align: center;
        }
        .dark .reg-title { color: #f1f5f9; }
        .reg-sub { font-size: 13px; color: #64748b; text-align: center; margin-bottom: 28px; }
        .dark .reg-sub { color: #94a3b8; }

        .role-cards { display: flex; flex-direction: column; gap: 14px; }
        .role-card {
          display: flex; align-items: center; gap: 16px;
          padding: 20px; border-radius: 16px;
          border: 2px solid #e2e8f0;
          cursor: pointer; transition: all 0.2s;
          background: white; text-align: left;
        }
        .dark .role-card { background: #0a1628; border-color: #1e3a5f; }
        .role-card:hover { border-color: #2563eb; }
        .role-card.selected { border-color: #2563eb; background: #eff6ff; }
        .dark .role-card.selected { background: #172554; border-color: #3b82f6; }
        .role-icon {
          width: 52px; height: 52px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .role-icon.student { background: #eff6ff; }
        .role-icon.vendor { background: #f0fdf4; }
        .dark .role-icon.student { background: #1e3a5f; }
        .dark .role-icon.vendor { background: #14532d; }
        .role-info { flex: 1; }
        .role-name {
          font-size: 15px; font-weight: 700;
          color: #0f172a; margin-bottom: 3px;
          font-family: var(--font-sora), Sora, sans-serif;
        }
        .dark .role-name { color: #f1f5f9; }
        .role-desc { font-size: 12px; color: #64748b; line-height: 1.4; }
        .dark .role-desc { color: #94a3b8; }
        .role-check {
          width: 22px; height: 22px; border-radius: 50%;
          border: 2px solid #e2e8f0;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.2s;
        }
        .role-card.selected .role-check { background: #2563eb; border-color: #2563eb; }

        .reg-continue {
          width: 100%; margin-top: 24px;
          padding: 13px; border-radius: 12px;
          background: #2563eb; color: white;
          font-size: 14px; font-weight: 600;
          border: none; cursor: pointer;
          transition: background 0.2s, opacity 0.2s;
          font-family: var(--font-sora), Sora, sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .reg-continue:hover:not(:disabled) { background: #1d4ed8; }
        .reg-continue:disabled { opacity: 0.6; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .reg-spinner { animation: spin 0.7s linear infinite; }

        .reg-back {
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; color: #64748b;
          background: none; border: none; cursor: pointer;
          margin-bottom: 20px; padding: 0;
        }
        .reg-back:hover { color: #2563eb; }
        .dark .reg-back { color: #94a3b8; }

        .reg-role-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 999px;
          font-size: 12px; font-weight: 600;
          margin: 0 auto 20px; width: fit-content;
        }
        .reg-role-pill.student { background: #eff6ff; color: #2563eb; }
        .reg-role-pill.vendor { background: #f0fdf4; color: #16a34a; }
        .dark .reg-role-pill.student { background: #1e3a5f; color: #60a5fa; }
        .dark .reg-role-pill.vendor { background: #14532d; color: #4ade80; }

        .reg-divider {
          display: flex; align-items: center; gap: 10px;
          margin: 18px 0;
        }
        .reg-divider-line { flex: 1; height: 1px; background: #e2e8f0; }
        .dark .reg-divider-line { background: #1e3a5f; }
        .reg-divider span { font-size: 12px; color: #94a3b8; }

        .reg-google {
          width: 100%; padding: 11px;
          border-radius: 12px; border: 1.5px solid #e2e8f0;
          background: white; cursor: pointer;
          font-size: 13px; font-weight: 600; color: #0f172a;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s;
        }
        .dark .reg-google { background: #0a1628; border-color: #1e3a5f; color: #f1f5f9; }
        .reg-google:hover { border-color: #2563eb; }

        .reg-field { margin-bottom: 14px; }
        .reg-label { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 5px; display: block; }
        .dark .reg-label { color: #94a3b8; }
        .reg-input {
          width: 100%; padding: 11px 14px;
          border-radius: 10px; border: 1.5px solid #e2e8f0;
          font-size: 14px; outline: none;
          background: white; color: #0f172a;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .dark .reg-input { background: #0a1628; border-color: #1e3a5f; color: #f1f5f9; }
        .reg-input:focus { border-color: #2563eb; }
        .reg-pass-wrap { position: relative; }
        .reg-pass-wrap .reg-input { padding-right: 44px; }
        .reg-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9ca3af; }

        .strength-bar { display: flex; gap: 4px; margin-top: 6px; }
        .strength-seg { height: 3px; flex: 1; border-radius: 2px; background: #e2e8f0; transition: background 0.3s; }

        .reg-error { font-size: 12px; color: #ef4444; text-align: center; margin-top: 8px; }
        .reg-signin { text-align: center; margin-top: 20px; font-size: 13px; color: #64748b; }
        .dark .reg-signin { color: #94a3b8; }
        .reg-signin a { color: #2563eb; font-weight: 600; text-decoration: none; }

        .confirm-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: #eff6ff;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
        }
        .dark .confirm-icon { background: #1e3a5f; }
      `}</style>

      <div className="reg-page">
        <Link href="/" className="reg-logo">
          <div className="reg-logo-icon">
            <ShoppingBag size={18} color="white" />
          </div>
          <span className="reg-logo-text">Campus<span>Mart</span></span>
        </Link>

        <div className="reg-card">

          {/* ── STEP 1: Role selection ── */}
          {step === "role" && (
            <>
              <div className="reg-title">Join CampusMart</div>
              <div className="reg-sub">How will you be using CampusMart?</div>

              <div className="role-cards">
                <button
                  className={`role-card ${role === "student" ? "selected" : ""}`}
                  onClick={() => setRole("student")}
                >
                  <div className="role-icon student">
                    <GraduationCap size={24} color="#2563eb" />
                  </div>
                  <div className="role-info">
                    <div className="role-name">As a Student</div>
                    <div className="role-desc">Browse listings, buy items, and discover deals from students on your campus.</div>
                  </div>
                  <div className="role-check">
                    {role === "student" && <Check size={13} color="white" strokeWidth={3} />}
                  </div>
                </button>

                <button
                  className={`role-card ${role === "vendor" ? "selected" : ""}`}
                  onClick={() => setRole("vendor")}
                >
                  <div className="role-icon vendor">
                    <Store size={24} color="#16a34a" />
                  </div>
                  <div className="role-info">
                    <div className="role-name">As a Vendor</div>
                    <div className="role-desc">List your items for sale, manage orders, and reach thousands of students.</div>
                  </div>
                  <div className="role-check">
                    {role === "vendor" && <Check size={13} color="white" strokeWidth={3} />}
                  </div>
                </button>
              </div>

              <button
                className="reg-continue"
                disabled={!role}
                onClick={() => { setStep("form"); setLoading(false); setError("") }}
              >
                Continue →
              </button>

              <div className="reg-signin" style={{ marginTop: 16 }}>
                Already have an account? <Link href="/login">Log in</Link>
              </div>
            </>
          )}

          {/* ── STEP 2: Fill details ── */}
          {step === "form" && (
            <>
              <button className="reg-back" onClick={() => { setStep("role"); setError(""); setLoading(false) }}>
                <ArrowLeft size={15} /> Back
              </button>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <div className={`reg-role-pill ${role}`}>
                  {role === "student" ? <GraduationCap size={13} /> : <Store size={13} />}
                  Signing up as {role === "student" ? "a Student" : "a Vendor"}
                </div>
              </div>

              <div className="reg-title" style={{ fontSize: 19 }}>Create your account</div>
              <div className="reg-sub">Fill in your details to get started</div>

              <button className="reg-google" onClick={handleGoogleSignUp}>
                <svg width="17" height="17" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>

              <div className="reg-divider">
                <div className="reg-divider-line" />
                <span>or</span>
                <div className="reg-divider-line" />
              </div>

              <div className="reg-field">
                <label className="reg-label">Full Name</label>
                <input
                  className="reg-input"
                  type="text"
                  placeholder="e.g. Amara Johnson"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="reg-field">
                <label className="reg-label">Email Address</label>
                <input
                  className="reg-input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="reg-field">
                <label className="reg-label">Password</label>
                <div className="reg-pass-wrap">
                  <input
                    className="reg-input"
                    type={showPass ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <button className="reg-eye" onClick={() => setShowPass(s => !s)}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.password.length > 0 && (
                  <>
                    <div className="strength-bar">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="strength-seg"
                          style={{ background: i <= strength ? strengthColor : undefined }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: strengthColor, marginTop: 3, fontWeight: 600 }}>
                      {strengthLabel}
                    </div>
                  </>
                )}
              </div>

              {error && <div className="reg-error">{error}</div>}

              <button
                className="reg-continue"
                style={{ marginTop: 8 }}
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="reg-spinner" />
                    Creating account...
                  </>
                ) : (
                  `Create ${role === "vendor" ? "Vendor" : "Student"} Account`
                )}
              </button>

              <div className="reg-signin">
                Already have an account? <Link href="/login">Log in</Link>
              </div>
            </>
          )}

          {/* ── STEP 3: Confirm email ── */}
          {step === "confirm" && (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div className="confirm-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <div className="reg-title" style={{ fontSize: 19, marginBottom: 8 }}>Check your email</div>
              <div className="reg-sub" style={{ marginBottom: 28, lineHeight: 1.7 }}>
                We sent a confirmation link to<br />
                <strong style={{ color: "#2563eb" }}>{form.email}</strong><br /><br />
                Click the link in the email to activate your account, then come back to log in.
              </div>
              <Link href="/login">
                <button className="reg-continue" style={{ marginTop: 0 }}>
                  Go to Login
                </button>
              </Link>
              <div className="reg-signin" style={{ marginTop: 16 }}>
                Wrong email?{" "}
                <button
                  onClick={() => { setStep("form"); setLoading(false); setError("") }}
                  style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                >
                  Go back
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}