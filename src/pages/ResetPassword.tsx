import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Lock,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../lib/apiClient";

export function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [resetToken, setResetToken] = useState(""); 

  useEffect(() => {
    const hash = window.location.hash;

    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const tokenType = hashParams.get("type");

      if (accessToken && tokenType === "recovery") {
        setResetToken(accessToken);
        validateTokenWithBackend(accessToken);
      } else {
        setError("Invalid reset link. Please request a new one.");
        setIsValidatingToken(false);
      }
    } else {
      setError("Please use the reset link from your email.");
      setIsValidatingToken(false);
    }
  }, []);

  const validateTokenWithBackend = async (token: string) => {
    try {
      const response = await authApi.validateResetToken(token);

      if (response.success && response.data) {
        const data = response.data as { user?: { email?: string } };
        const userEmail = data.user?.email;

        if (userEmail) {
          setUserEmail(userEmail);
          setIsValidatingToken(false);
          toast.success("Reset link validated successfully");
        } else {
          setError("Invalid response from server");
          setIsValidatingToken(false);
          toast.error("Failed to validate reset link");
        }
      } else {
        const errorMessage = response.message || "Invalid reset token";
        setError(errorMessage);
        setIsValidatingToken(false);
        toast.error(errorMessage);
      }
    } catch (err: any) {
      console.error("❌ Token validation error:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to validate reset link. Please try again.";
      setError(errorMessage);
      setIsValidatingToken(false);
      toast.error(errorMessage);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.resetPassword(
        newPassword,
        confirmPassword,
        resetToken 
      );

      if (response.success) {
        setSuccess(true);
        toast.success("Password reset successfully!");
        setTimeout(() => {
          navigate("/signin");
        }, 3000);
      } else {
        throw new Error(response.message || "Failed to reset password");
      }
    } catch (err: any) {
      console.error("❌ Reset password error:", err);

      if (err.response?.status === 401 || err.message?.includes("401")) {
        const errorMessage =
          "Reset link has expired. Please request a new password reset email.";
        setError(errorMessage);
        toast.error(errorMessage);
      } else if (err.response?.status === 429) {
        const errorMessage = "Too many attempts. Please wait a few minutes.";
        setError(errorMessage);
        toast.error(errorMessage);
      } else {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "Failed to reset password";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (isValidatingToken) {
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
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Validating reset link...</p>
            <p className="text-sm text-gray-500 mt-2">
              Please wait while we verify your reset link
            </p>
          </div>
        </div>
      </div>
    );
  }

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
                Password Reset!
              </h2>
              <p className="text-gray-600 mb-6">
                Your password has been reset successfully. Redirecting to sign
                in...
              </p>
              <Link
                to="/signin"
                className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Go to Sign In Now
              </Link>
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
            Reset Password
          </h1>
          <p className="text-gray-300">Enter your new password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800 font-medium">{error}</p>
                {(error.includes("expired") ||
                  error.includes("invalid") ||
                  error.includes("Please use")) && (
                  <Link
                    to="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block"
                  >
                    Request a new reset link
                  </Link>
                )}
              </div>
            </div>
          )}

          {!userEmail ? (
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Invalid or expired reset link.
              </p>
              <Link
                to="/forgot-password"
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  Resetting password for: <strong>{userEmail}</strong>
                </p>
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  "Reset Password"
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/signin"
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}