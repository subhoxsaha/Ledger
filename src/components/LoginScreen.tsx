import React, { useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "../firebase";
import { Layers, Sparkles, ShieldCheck, Mail, Lock, LogIn, AlertCircle, RefreshCw } from "lucide-react";

interface LoginScreenProps {
  onGuestAccess?: () => void;
}

export default function LoginScreen({ onGuestAccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Enforce custom account select prompt for volunteers switching desk emails
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Auth raw error", err);
      // Give readable feedback
      if (err.code === "auth/popup-blocked") {
        setError("Sign-in popup blocked by the browser. Please check browser pop-up permissions!");
      } else {
        setError(err.message || "An unexpected issue occurred during Google Sign-In.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all email and password fields.");
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage("Account created successfully! Welcome to the Event Ledger.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Email Auth raw error", err);
      switch (err.code) {
        case "auth/user-not-found":
          setError("No registered volunteer profile found with this email.");
          break;
        case "auth/wrong-password":
          setError("Incorrect password credentials entered. Please try again.");
          break;
        case "auth/invalid-email":
          setError("The email address provided is formatted incorrectly.");
          break;
        case "auth/weak-password":
          setError("Password should be at least 6 characters long.");
          break;
        case "auth/email-already-in-use":
          setError("An account already exists with this email address.");
          break;
        case "auth/configuration-not-found":
          setError("Email/Password Sign-in authentication must be enabled in the Firebase Console first. Try Sign in with Google.");
          break;
        case "auth/operation-not-allowed":
          setError("Email/Password login is not enabled currently. Please use Sign in with Google above.");
          break;
        default:
          setError(err.message || "Authentication attempt failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please input your email address above to receive a reset link.");
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("A password reset link has been dispatched to your email address.");
    } catch (err: any) {
      setError(err.message || "Failed to dispatch recovery password email reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-indigo-600 selection:text-white antialiased">
      {/* Visual Top Highlight Accent */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 w-full"></div>

      {/* Main Login Card Outer Wrapper */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 p-6 md:p-8 space-y-6 relative overflow-hidden">
          
          {/* Subtle Ambient Core Accent Backdrops (Pure Styling) */}
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-emerald-500/5  rounded-full blur-xl pointer-events-none"></div>

          {/* Core Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/10 mb-2">
              <Layers className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-display font-extrabold tracking-tight text-slate-900">
              Event Ledger Secure
            </h1>
            <p className="text-xs text-slate-500 font-sans max-w-[280px] mx-auto">
              Volunteers & Admin desk workspace. Secure credential authentication.
            </p>
          </div>

          {/* Feedback banners */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-start gap-2 animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* Primary Action Panel: Seamless integration with Google & Guest Access */}
          <div className="space-y-3">
            {onGuestAccess && (
              <button
                onClick={onGuestAccess}
                disabled={loading}
                type="button"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:from-indigo-805 text-white text-sm font-bold rounded-xl transition duration-150 flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="h-4.5 w-4.5 text-indigo-100 animate-pulse" />
                <span>1-Click Guest Workspace Access</span>
              </button>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition duration-150 flex items-center justify-center gap-3 shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 text-slate-400 animate-spin" />
              ) : (
                <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61a5.66 5.66 0 0 1-2.45 3.73v3.08h3.95c2.31-2.13 3.63-5.26 3.63-8.91z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.95-3.08c-1.1.74-2.5 1.18-3.98 1.18-3.06 0-5.64-2.07-6.57-4.86H1.44v3.18C3.41 21.05 7.42 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.43 14.33a7.16 7.16 0 0 1 0-4.66V6.49H1.44a11.96 11.96 0 0 0 0 11.02l3.99-3.18z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.42 0 3.41 2.95 1.44 6.49l3.99 3.18c.93-2.79 3.51-4.86 6.57-4.86z"
                  />
                </svg>
              )}
              <span>Sign in with Google</span>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-3 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                or use password
              </span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>
          </div>

          {/* Secondary fallback credential sign-in */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
                Volunteer Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white text-slate-800 text-sm rounded-xl outline-hidden transition duration-150"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
                  Password
                </label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] font-sans font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white text-slate-800 text-sm rounded-xl outline-hidden transition duration-150"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              <span>{isRegistering ? "Create Desk Account" : "Access Desk Console"}</span>
            </button>
          </form>

          {/* Toggle register flag button state */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                setError(null);
                setMessage(null);
                setIsRegistering(!isRegistering);
              }}
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors font-medium"
            >
              {isRegistering 
                ? "Already have a volunteer workspace? Sign In" 
                : "Need a local volunteer account? Create profile"}
            </button>
          </div>

        </div>
      </div>

      {/* Footer information copyright lines to provide highly styled dashboard details */}
      <footer className="py-4 text-center border-t border-slate-100 bg-white">
        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
          <span>Secured with Cloud SSL & Firebase Multi-Factor Verification</span>
        </p>
      </footer>
    </div>
  );
}
