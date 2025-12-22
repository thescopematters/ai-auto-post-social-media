import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'; // Import Eye and EyeOff
import { toast } from 'sonner';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // --- NEW STATE: to toggle password visibility ---
  const [showPassword, setShowPassword] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  // --- NEW HANDLER: to switch the password visibility state ---
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Only clear error if we are starting a fresh attempt and it's not already loading
    if (!loading) setError('');
    setLoading(true);
    const startTime = Date.now();

    const { error: signInError } = await signIn(email, password);

    // Ensure loading state lasts at least 800ms to prevent flickering
    const duration = Date.now() - startTime;
    if (duration < 800) {
      await new Promise(resolve => setTimeout(resolve, 800 - duration));
    }

    if (signInError) {
      let errorMessage = 'Invalid email or password'; // Default error message

      // **Specific Error Check for "User not found"**
      // NOTE: This check depends on the error structure returned by your useAuth().signIn implementation.
      const errorString = signInError.message ? signInError.message.toLowerCase() : '';

      // If the underlying authentication service (e.g., Firebase, custom API) indicates the user 
      // doesn't exist, we show a specific message.
      if (errorString.includes('user-not-found') || errorString.includes('no user found') || errorString.includes('auth/user-not-found')) {
        errorMessage = 'User profile not found. Please check your email or sign up.';
      } else if (errorString.includes('wrong-password') || errorString.includes('invalid-credential')) {
        // Keep the generic message for wrong passwords to avoid leaking info about valid emails
        errorMessage = 'Invalid email or password';
      }

      // Otherwise, we default to the generic 'Invalid email or password' message 
      // for security (e.g., if the password was wrong).
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 text-white mb-8">
            <Sparkles className="w-8 h-8" />
            <span className="text-2xl font-bold">ContentAI Pro</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mt-6 mb-2">Welcome back</h1>
          <p className="text-gray-300">Sign in to your account to continue</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  // --- CHANGE: Dynamically set input type based on showPassword state ---
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  // --- CHANGE: Increased padding to the right (pr-12) to make space for the toggle button ---
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
                {/* --- NEW ELEMENT: Visibility Toggle Button --- */}
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
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
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}