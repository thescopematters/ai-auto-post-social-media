import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Mail,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../lib/apiClient";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const storedCooldown = localStorage.getItem("forgotPasswordCooldown");
    if (storedCooldown) {
      const remaining = Math.max(0, parseInt(storedCooldown) - Date.now());
      if (remaining > 0) {
        setCooldown(Math.ceil(remaining / 1000));
      } else {
        localStorage.removeItem("forgotPasswordCooldown");
      }
    }
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem("forgotPasswordCooldown");
    }
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (cooldown > 0) {
      toast.error(`Please wait ${cooldown} seconds before trying again`);
      return;
    }

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.forgotPassword(email);

      if (response.success) {
        setSuccess(true);
        const cooldownTime = 2 * 60 * 1000; // 2 minutes
        localStorage.setItem(
          "forgotPasswordCooldown",
          (Date.now() + cooldownTime).toString()
        );
        setCooldown(120);

        toast.success(
          "If an account exists, a reset link has been sent to your email."
        );
      } else {
        throw new Error(response.message || "Failed to send reset email");
      }
    } catch (err: any) {
      console.error("❌ Forgot password error:", err);

      if (err.response?.status === 429) {
        const cooldownTime = 5 * 60 * 1000; // 5 minutes
        localStorage.setItem(
          "forgotPasswordCooldown",
          (Date.now() + cooldownTime).toString()
        );
        setCooldown(300);

        const errorMessage =
          "Too many attempts. Please wait 5 minutes before trying again.";
        setError(errorMessage);
        toast.error(errorMessage);
      } else {
        const errorMessage =
          "A reset link has been sent. Please check your inbox and spam folder.";
        setError(errorMessage);
        toast.info("Check your email for the reset link");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link
              to="/"
              className="inline-flex items-center space-x-2 text-white mb-8"
            >
              <Sparkles className="w-8 h-8" />
              <span className="text-2xl font-bold">ContentAI Pro</span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Check your email
              </h2>
              <p className="text-gray-600 mb-4">
                If an account exists with <strong>{email}</strong>, we've sent
                you a password reset link.
              </p>

              {cooldown > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-700">
                    You can request another email in {cooldown} seconds
                  </span>
                </div>
              )}

              <p className="text-sm text-gray-500 mb-6">
                Didn't receive the email? Check your spam folder or try again
                later.
              </p>
              <div className="space-y-3">
                <Link
                  to="/signin"
                  className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Back to Sign In
                </Link>
                <button
                  onClick={() => {
                    setSuccess(false);
                    setEmail("");
                  }}
                  disabled={cooldown > 0}
                  className="block w-full text-blue-600 hover:text-blue-700 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {cooldown > 0
                    ? `Try another email (${cooldown}s)`
                    : "Try another email"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 text-white mb-8"
          >
            <Sparkles className="w-8 h-8" />
            <span className="text-2xl font-bold">ContentAI Pro</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mt-6 mb-2">
            Forgot Password?
          </h1>
          <p className="text-gray-300">
            Enter your email to reset your password
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                  {cooldown > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      Please wait {cooldown} seconds before trying again
                    </p>
                  )}
                </div>
              </div>
            )}

            {cooldown > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-yellow-800 font-medium">
                    Rate limit active
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    You can try again in {cooldown} seconds
                  </p>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={cooldown > 0}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : cooldown > 0 ? (
                <>
                  <Clock className="w-4 h-4" />
                  Wait {cooldown}s
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/signin"
              className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
