import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
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

  return (
    <div className="min-h-screen flex bg-white font-sans text-[#1A1F2C]">
      {/* Left Side: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 py-12">
        <div className="max-w-md w-full mx-auto">
          <Link to="/" className="inline-flex items-center text-gray-400 hover:text-gray-600 mb-12 transition group text-sm font-bold uppercase tracking-widest">
            <ChevronLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to home
          </Link>

          {success ? (
            <div className="text-left">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-8">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h1 className="text-4xl font-black tracking-tight mb-3">Check your email.</h1>
              <p className="text-gray-500 font-medium mb-8">
                If an account exists with <strong>{email}</strong>, we've sent you a password reset link.
              </p>

              {cooldown > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-8 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#2C64E3]" />
                  <span className="text-sm text-blue-800 font-medium">
                    You can request another email in {cooldown} seconds
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <Link
                  to="/signin"
                  className="block w-full bg-[#2C64E3] text-white py-4 rounded-2xl font-bold text-center hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                >
                  Back to Sign In
                </Link>
                <button
                  onClick={() => {
                    setSuccess(false);
                    setEmail("");
                  }}
                  disabled={cooldown > 0}
                  className="w-full text-[#2C64E3] hover:underline font-bold disabled:text-gray-400 disabled:no-underline"
                >
                  {cooldown > 0
                    ? `Try another email (${cooldown}s)`
                    : "Try another email"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-10">
                <h1 className="text-4xl font-black tracking-tight mb-3">Forgot password?</h1>
                <p className="text-gray-500 font-medium">No worries, we'll send you reset instructions.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 font-medium">{error}</p>
                  </div>
                )}

                {cooldown > 0 && (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-800 font-bold">Rate limit active</p>
                      <p className="text-xs text-yellow-700 font-medium">You can try again in {cooldown} seconds</p>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-300" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={cooldown > 0}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#2C64E3] focus:bg-white transition shadow-inner disabled:opacity-50"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldown > 0}
                  className="w-full bg-[#2C64E3] text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    'Sending link...'
                  ) : (
                    <>
                      Send reset link
                      <ChevronLeft className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-10 text-center">
                <Link
                  to="/signin"
                  className="text-gray-500 font-medium hover:text-[#2C64E3] transition flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={16} />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Side: Visual/Branding */}
      <div className="hidden lg:flex flex-1 relative bg-[#1A1F2C] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img src="/auth-bg.png" alt="Background" className="w-full h-full object-cover grayscale" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#2C64E3]/30 via-transparent to-black/60"></div>

        <div className="relative z-10 max-w-lg px-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-2xl mb-12 transform -rotate-12 hover:rotate-0 transition-transform duration-500">
            <img src="/logo.png" alt="Logo" className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-6 leading-tight">
            Forgot your password? <br /> We've got you covered.
          </h2>
          <p className="text-lg text-blue-100 mb-12 font-medium opacity-80 leading-relaxed">
            "ContentAI Pro's security features and recovery flows are seamless. I never worry about losing access to my brand assets."
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#2C64E3] font-bold shadow-lg">M</div>
            <div className="text-left">
              <p className="text-white font-bold leading-tight">Michael Chen</p>
              <p className="text-blue-200 text-sm font-medium opacity-60">Operations Lead @ GrowthFlow</p>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-[#2C64E3] rounded-full blur-[120px] opacity-20"></div>
        <div className="absolute top-10 left-10 w-48 h-48 bg-purple-500 rounded-full blur-[100px] opacity-10"></div>
      </div>
    </div>
  );
}
