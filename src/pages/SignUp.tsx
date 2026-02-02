import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, User, AlertCircle, CheckCircle, Eye, EyeOff, ChevronLeft, Zap, Shield, Sparkles, Briefcase } from 'lucide-react';

const validatePassword = (password: string): string | null => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (!hasUpperCase) return 'Password must contain at least one uppercase letter.';
  if (!hasLowerCase) return 'Password must contain at least one lowercase letter.';
  if (!hasNumber) return 'Password must contain at least one number.';
  if (!hasSpecialChar) return 'Password must contain at least one special character.';

  return null;
};

export function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('');
  const [customRole, setCustomRole] = useState('');

  const roles = [
    'Businessman',
    'Frontend developer',
    'Backend developer',
    'Software engineer',
    'Data analytics',
    'Doctor',
    'Cloud or AWS engineer',
    'Other'
  ];

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    if (role === 'Other') {
      if (!customRole.trim()) {
        setError('Please specify your role.');
        setLoading(false);
        return;
      }
      if (customRole.length > 50) {
        setError('Role must be at most 50 characters long.');
        setLoading(false);
        return;
      }
      if (!/^[a-zA-Z\s]*$/.test(customRole)) {
        setError('Role can only contain letters and spaces.');
        setLoading(false);
        return;
      }
    }

    const finalRole = role === 'Other' ? customRole : role;
    const { error: signUpError } = await signUp(email, password, fullName, finalRole);

    if (signUpError) {
      let customErrorMessage = signUpError.message;
      const errorMessage = (signUpError.message || '').toLowerCase();
      const errorCode = (signUpError as any).code || '';

      if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('already exists')) {
        customErrorMessage = 'This email is already in use. Please sign in instead.';
      }

      setError(customErrorMessage);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans text-[#1A1F2C]">
      {/* Right Side: Visual/Branding (Flipped for variety) */}
      <div className="hidden lg:flex flex-1 relative bg-[#1A1F2C] items-center justify-center overflow-hidden order-2">
        <div className="absolute inset-0 opacity-40">
          <img src="/auth-bg.png" alt="Background" className="w-full h-full object-cover grayscale" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-bl from-[#2C64E3]/30 via-transparent to-black/60"></div>

        <div className="relative z-10 max-w-lg px-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-2xl mb-12">
            <img src="/logo.png" alt="Logo" className="w-10 h-10" />
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-10 leading-tight">
            Start your journey to <br /> social mastery.
          </h2>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="text-yellow-400 w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold">Turbocharge Workflow</h4>
                <p className="text-blue-100/60 text-sm leading-relaxed">Automate 90% of your content creation tasks today.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="text-purple-400 w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold">AI-Powered Insights</h4>
                <p className="text-blue-100/60 text-sm leading-relaxed">Our AI learns your brand voice for perfect consistency.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="text-green-400 w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold">Enterprise Security</h4>
                <p className="text-blue-100/60 text-sm leading-relaxed">Your data is encrypted and safe with our Pro infrastructure.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-blue-600 rounded-full blur-[150px] opacity-20"></div>
        <div className="absolute bottom-0 -left-20 w-96 h-96 bg-[#2C64E3] rounded-full blur-[120px] opacity-10"></div>
      </div>

      {/* Left Side: Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 xl:px-32 py-12 order-1">
        <div className="max-w-md w-full mx-auto">
          <Link to="/" className="inline-flex items-center text-gray-400 hover:text-gray-600 mb-10 transition group text-sm font-bold uppercase tracking-widest">
            <ChevronLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to home
          </Link>

          <div className="mb-8">
            <h1 className="text-4xl font-black tracking-tight mb-3">Join us today.</h1>
            <p className="text-gray-500 font-medium">Create your ContentAI Pro account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#2C64E3] focus:bg-white transition shadow-inner"
                  placeholder="John Doe"
                />
              </div>
            </div>

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
              <label htmlFor="role" className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                Your Role
              </label>
              <div className="relative">
                <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-300 pointer-events-none" />
                <select
                  id="role"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full pl-12 pr-10 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#2C64E3] focus:bg-white transition shadow-inner appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select your role</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-300">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {role === 'Other' && (
              <div>
                <label htmlFor="customRole" className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                  Specify Your Role
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-300" />
                  <input
                    id="customRole"
                    type="text"
                    required
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#2C64E3] focus:bg-white transition shadow-inner"
                    placeholder="Enter your role"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                Password
              </label>
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

            <div className="bg-blue-50/50 rounded-2xl p-4 space-y-2 border border-blue-100">
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#2C64E3] uppercase tracking-wider">
                <CheckCircle className="w-4 h-4" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#2C64E3] uppercase tracking-wider">
                <CheckCircle className="w-4 h-4" />
                <span>14-day free trial included</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1F2C] text-white py-4 rounded-2xl font-bold hover:bg-black transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? 'Creating account...' : 'Start your free trial'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500 font-medium">
              Already have an account?{' '}
              <Link to="/signin" className="text-[#2C64E3] hover:underline font-bold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}