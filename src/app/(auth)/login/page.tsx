"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    toast.success("Welcome back!")
    router.push("/")
    router.refresh()
  }

  const handleGoogle = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .auth-page { font-family: 'DM Sans', sans-serif; }
        .auth-display { font-family: 'Sora', sans-serif; }

        .auth-wrap {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr;
          background: #f8faff;
        }
        @media(min-width: 1024px) {
          .auth-wrap { grid-template-columns: 1fr 1fr; }
        }

        .auth-left {
          display: none;
          background: linear-gradient(135deg, #0a0f2e 0%, #0d1854 50%, #1a1060 100%);
          position: relative;
          overflow: hidden;
          padding: 48px;
          flex-direction: column;
          justify-content: space-between;
        }
        @media(min-width: 1024px) { .auth-left { display: flex; } }

        .auth-left::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 70% 60% at 60% 30%, rgba(37,99,235,0.3) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 20% 80%, rgba(147,51,234,0.2) 0%, transparent 50%);
          pointer-events: none;
        }
        .auth-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
        }
        .auth-left-content { position: relative; }
        .auth-logo {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none;
        }
        .auth-logo-mark {
          width: 40px; height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Sora', sans-serif;
          font-size: 18px; font-weight: 800;
          color: #fff;
          box-shadow: 0 4px 16px rgba(37,99,235,0.4);
        }
        .auth-logo-name {
          font-family: 'Sora', sans-serif;
          font-size: 20px; font-weight: 700;
          color: #fff;
        }
        .auth-left-title {
          font-family: 'Sora', sans-serif;
          font-size: 2.5rem; font-weight: 800;
          color: #fff; line-height: 1.1;
          letter-spacing: -0.03em;
          margin-bottom: 16px;
        }
        .auth-left-title .grad {
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .auth-left-sub {
          font-size: 15px; color: rgba(255,255,255,0.6);
          line-height: 1.6; max-width: 340px;
        }
        .auth-perks {
          display: flex; flex-direction: column; gap: 14px;
          margin-top: 36px;
        }
        .auth-perk {
          display: flex; align-items: center; gap: 12px;
        }
        .auth-perk-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          flex-shrink: 0;
        }
        .auth-perk-text {
          font-size: 14px; color: rgba(255,255,255,0.75);
          font-weight: 400;
        }
        .auth-bottom-card {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 20px 24px;
          backdrop-filter: blur(12px);
          position: relative;
        }
        .auth-bottom-quote {
          font-size: 14px; color: rgba(255,255,255,0.8);
          line-height: 1.6; font-style: italic;
          margin-bottom: 12px;
        }
        .auth-bottom-author {
          font-size: 12px; color: rgba(255,255,255,0.5);
          font-weight: 500;
        }

        /* Right side - form */
        .auth-right {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 48px 24px;
          min-height: 100vh;
        }
        .auth-form-wrap {
          width: 100%; max-width: 420px;
        }
        .auth-form-logo {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none; margin-bottom: 40px;
        }
        @media(min-width: 1024px) { .auth-form-logo { display: none; } }
        .auth-title {
          font-family: 'Sora', sans-serif;
          font-size: 1.875rem; font-weight: 800;
          color: #0a0f2e;
          letter-spacing: -0.02em;
          margin-bottom: 6px;
        }
        .auth-subtitle {
          font-size: 14px; color: #6b7280;
          margin-bottom: 32px; line-height: 1.5;
        }
        .auth-subtitle a {
          color: #2563eb; font-weight: 600; text-decoration: none;
        }
        .auth-subtitle a:hover { text-decoration: underline; }

        /* Google button */
        .google-btn {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 13px 20px;
          border-radius: 12px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .google-btn:hover {
          border-color: #d1d5db;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }

        .divider {
          display: flex; align-items: center; gap: 12px;
          margin: 24px 0;
        }
        .divider-line { flex: 1; height: 1px; background: #e5e7eb; }
        .divider-text { font-size: 12px; color: #9ca3af; font-weight: 500; }

        /* Form fields */
        .field { margin-bottom: 18px; }
        .field-label {
          display: block;
          font-size: 13px; font-weight: 600;
          color: #374151; margin-bottom: 7px;
        }
        .field-input-wrap { position: relative; }
        .field-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #111827;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .field-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
        .field-input::placeholder { color: #9ca3af; }
        .field-input.has-icon { padding-right: 48px; }
        .field-icon-btn {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: #9ca3af; cursor: pointer;
          display: flex; align-items: center;
          padding: 4px;
          transition: color 0.2s;
        }
        .field-icon-btn:hover { color: #374151; }

        .forgot-link {
          display: block; text-align: right;
          font-size: 13px; color: #2563eb;
          font-weight: 600; text-decoration: none;
          margin-top: 6px;
        }
        .forgot-link:hover { text-decoration: underline; }

        .submit-btn {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px 20px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 600;
          border: none; cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(37,99,235,0.35);
          margin-top: 24px;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(37,99,235,0.45);
          filter: brightness(1.06);
        }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .auth-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 13px; color: #9ca3af;
        }
        .auth-footer a { color: #2563eb; font-weight: 600; text-decoration: none; }
        .auth-footer a:hover { text-decoration: underline; }
      `}</style>

      <div className="auth-page">
        <div className="auth-wrap">

          {/* Left panel */}
          <div className="auth-left">
            <div className="auth-grid" />
            <div className="auth-left-content">
              <Link href="/" className="auth-logo">
                <div className="auth-logo-mark">C</div>
                <span className="auth-logo-name">CampusMart</span>
              </Link>
            </div>
            <div className="auth-left-content" style={{ margin: "auto 0" }}>
              <h2 className="auth-left-title">
                Your campus<br />
                <span className="grad">marketplace</span><br />
                awaits.
              </h2>
              <p className="auth-left-sub">
                Buy textbooks, gadgets, food and more from
                fellow students — or start selling in under 2 minutes.
              </p>
              <div className="auth-perks">
                {[
                  "Free to join — no hidden fees",
                  "Secure payments via Paystack",
                  "Instant WhatsApp order alerts",
                  "Campus delivery to your hostel",
                ].map((perk) => (
                  <div key={perk} className="auth-perk">
                    <div className="auth-perk-dot" />
                    <span className="auth-perk-text">{perk}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="auth-left-content">
              <div className="auth-bottom-card">
                <p className="auth-bottom-quote">
                  "I sold my 300L textbooks in less than 24 hours.
                  CampusMart is the real deal."
                </p>
                <span className="auth-bottom-author">
                  — Campus seller, Computer Science
                </span>
              </div>
            </div>
          </div>

          {/* Right panel - form */}
          <div className="auth-right">
            <div className="auth-form-wrap">

              {/* Mobile logo */}
              <Link href="/" className="auth-form-logo">
                <div className="auth-logo-mark">C</div>
                <span className="auth-logo-name" style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 700, color: "#0a0f2e" }}>
                  CampusMart
                </span>
              </Link>

              <h1 className="auth-title">Welcome back</h1>
              <p className="auth-subtitle">
                Don't have an account?{" "}
                <Link href="/register">Sign up free</Link>
              </p>

              {/* Google sign in */}
              <button onClick={handleGoogle} className="google-btn">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="divider">
                <div className="divider-line" />
                <span className="divider-text">or continue with email</span>
                <div className="divider-line" />
              </div>

              <form onSubmit={handleLogin}>
                <div className="field">
                  <label className="field-label">Email address</label>
                  <input
                    type="email"
                    className="field-input"
                    placeholder="you@university.edu.ng"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="field">
                  <label className="field-label">Password</label>
                  <div className="field-input-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="field-input has-icon"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="field-icon-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Link href="/forgot-password" className="forgot-link">
                    Forgot password?
                  </Link>
                </div>

                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Signing in...</>
                  ) : (
                    <>Sign in <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <div className="auth-footer">
                By signing in, you agree to our{" "}
                <Link href="/terms">Terms</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}