import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, AlertCircle, Eye, EyeOff, ChevronLeft } from 'lucide-react';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      let errorMessage = 'Invalid email or password';
      const errorString = signInError.message ? signInError.message.toLowerCase() : '';

      if (errorString.includes('user-not-found') || errorString.includes('no user found') || errorString.includes('auth/user-not-found')) {
        errorMessage = 'User profile not found. Please check your email or sign up.';
      }

      setError(errorMessage);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans text-[#1A1F2C]">
      {/* Left Side: Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 xl:px-32 py-12">
        <div className="max-w-md w-full mx-auto">
          <Link to="/" className="inline-flex items-center text-gray-400 hover:text-gray-600 mb-12 transition group text-sm font-bold uppercase tracking-widest">
            <ChevronLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to home
          </Link>


          <div className="mb-10">
            <h1 className="text-4xl font-black tracking-tight mb-3">Welcome back.</h1>
            <p className="text-gray-500 font-medium">Log in to your account below.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 font-medium">{error}</p>
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
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#2C64E3] focus:bg-white transition shadow-inner"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 ml-1">
                <label htmlFor="password" className="block text-[11px] font-black uppercase tracking-widest text-gray-400">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#2C64E3] hover:underline font-bold"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#2C64E3] focus:bg-white transition shadow-inner"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500 transition"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2C64E3] text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed group scale-100 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? 'Signing in...' : 'Sign in'}
                {!loading && <ChevronLeft className="w-4 h-4 rotate-180 transform group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>
          </form>

          <p className="mt-10 text-center text-gray-500 font-medium">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#2C64E3] hover:underline font-bold">
              Sign up
            </Link>
          </p>
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
            Elevate your social media <br /> presence with AI.
          </h2>
          <p className="text-lg text-blue-100 mb-12 font-medium opacity-80 leading-relaxed">
            "ContentAI Pro has halved my creation time while doubling my engagement. It's truly a game-changer for digital marketers."
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#2C64E3] font-bold shadow-lg">S</div>
            <div className="text-left">
              <p className="text-white font-bold leading-tight">Sarah Jenkins</p>
              <p className="text-blue-200 text-sm font-medium opacity-60">Director @ MarketGrow</p>
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