import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Mail, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react'; // Import Eye and EyeOff

// Custom password validation function
const validatePassword = (password: string): string | null => {
  if (password.length < 8) { // Increased minimum length for better security
    return 'Password must be at least 8 characters long.';
  }
  // Check for uppercase, lowercase, number, and special character
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (!hasUpperCase) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!hasLowerCase) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!hasNumber) {
    return 'Password must contain at least one number.';
  }
  if (!hasSpecialChar) {
    return 'Password must contain at least one special character (e.g., !, @, #, $).';
  }

  return null; // Password is valid
};

export function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // --- NEW STATE: to toggle password visibility ---
  const [showPassword, setShowPassword] = useState(false); 
  
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // --- NEW HANDLER: to switch the password visibility state ---
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // --- 1. NEW CLIENT-SIDE PASSWORD VALIDATION ---
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    // --- 2. SIGN UP CALL ---
    const { error: signUpError } = await signUp(email, password, fullName);

    if (signUpError) {
      // --- 3. CUSTOM ERROR MESSAGE HANDLING ---
      let customErrorMessage = 'An unknown error occurred during sign up.';

      // Logic to check if the error is due to a duplicate email.
      const errorMessage = (signUpError.message || '').toLowerCase();
      const errorCode = (signUpError as any).code || '';

      // *** MODIFIED LOGIC HERE ***
      // We check for 'already exists', 'duplicate', 'auth/email-already-in-use', 
      // OR explicitly check for the status code 409, which the server returns.
      if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('already exists') || errorMessage.includes('duplicate') || errorMessage.includes('status code 409')) {
        customErrorMessage = 'This email is already in use. Please sign in or use a different email.';
      } else if (errorMessage.includes('password') && !passwordError) {
        // Catch any remaining password errors from the server side
        customErrorMessage = 'Server-side password requirement failed. Please check your password.';
      } else if (errorMessage.includes('404') || errorMessage.includes('network') || errorMessage.includes('failed to fetch')) {
        customErrorMessage = 'A network error occurred. Please check your connection and try again.';
      } else {
        // Default to the error message returned by the auth function if not specifically handled
        customErrorMessage = signUpError.message;
      }

      setError(customErrorMessage);
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
          <h1 className="text-3xl font-bold text-white mt-6 mb-2">Create your account</h1>
          <p className="text-gray-300">Start automating your social content today</p>
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
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
            </div>

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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
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
                  placeholder="At least 8 chars, incl. special & upper/lower/num"
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
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/signin" className="text-blue-600 hover:text-blue-700 font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}