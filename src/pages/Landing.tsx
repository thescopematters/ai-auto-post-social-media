import { Link } from 'react-router-dom';
import { Sparkles, FileText, Calendar, BarChart3, Shield, Zap } from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <nav className="container mx-auto px-6 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2 text-white">
            <Sparkles className="w-8 h-8" />
            <span className="text-2xl font-bold">ContentAI Pro</span>
          </div>
          <div className="flex gap-4">
            <Link
              to="/signin"
              className="px-6 py-2 text-white hover:text-blue-200 transition"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
            Transform Documents into
            <span className="text-blue-400"> Engaging Social Content</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Automate your LinkedIn and Twitter content creation with AI. Upload documents,
            generate professional posts, and maintain consistent engagement.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
          >
            Start Free Trial
            <Sparkles className="ml-2 w-5 h-5" />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <FeatureCard
            icon={<FileText className="w-12 h-12 text-blue-400" />}
            title="Smart Document Processing"
            description="Upload PDFs, Word docs, or URLs. Our AI extracts key insights and transforms them into shareable content."
          />
          <FeatureCard
            icon={<Sparkles className="w-12 h-12 text-blue-400" />}
            title="AI Content Generation"
            description="Generate multiple post variants with customizable tone, style, and intent. Perfect for LinkedIn and Twitter."
          />
          <FeatureCard
            icon={<Calendar className="w-12 h-12 text-blue-400" />}
            title="Automated Scheduling"
            description="Schedule posts in advance with smart timing suggestions based on audience engagement patterns."
          />
          <FeatureCard
            icon={<Shield className="w-12 h-12 text-blue-400" />}
            title="Quality Moderation"
            description="Built-in moderation workflow ensures brand safety and content quality before publishing."
          />
          <FeatureCard
            icon={<BarChart3 className="w-12 h-12 text-blue-400" />}
            title="Performance Analytics"
            description="Track engagement metrics and get AI-driven insights to optimize your content strategy."
          />
          <FeatureCard
            icon={<Zap className="w-12 h-12 text-blue-400" />}
            title="Multi-Platform Support"
            description="Manage LinkedIn and Twitter from one dashboard with platform-specific optimizations."
          />
        </div>

        <div className="text-center text-gray-400 py-12 border-t border-gray-700">
          <p>&copy; 2025 ContentAI Pro. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 hover:bg-white/10 transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-gray-300 leading-relaxed">{description}</p>
    </div>
  );
}
