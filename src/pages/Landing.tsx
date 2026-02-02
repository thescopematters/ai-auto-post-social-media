import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, FileText, Calendar, BarChart3, Zap, Check, ArrowRight, Instagram, Linkedin, Twitter, Facebook, Github, ChevronRight, Quote, Plus, Minus } from 'lucide-react';

import { Footer } from '../components/Footer';

export function Landing() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#2D3748]">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="ContentAI Pro" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold tracking-tight">ContentAI Pro</span>
            </div>

            <div className="hidden md:flex items-center space-x-10">
              <a href="#features" className="text-sm font-bold text-gray-500 hover:text-[#2C64E3] transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-bold text-gray-500 hover:text-[#2C64E3] transition-colors">Pricing</a>
              <a href="#channels" className="text-sm font-bold text-gray-500 hover:text-[#2C64E3] transition-colors">Channels</a>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/signin"
                className="px-4 py-2 text-sm font-semibold hover:text-blue-600 transition"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2.5 bg-[#2C64E3] text-white rounded-md text-sm font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
              >
                Get started now
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center relative">
            {/* Floating Social Icons (Abstract) */}
            <div className="absolute -left-20 top-0 hidden lg:block animate-bounce-slow">
              <div className="w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center text-blue-400">
                <Linkedin size={24} />
              </div>
            </div>
            <div className="absolute -right-20 top-20 hidden lg:block animate-bounce-slow delay-150">
              <div className="w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center text-sky-400">
                <Twitter size={24} />
              </div>
            </div>
            <div className="absolute left-10 -bottom-10 hidden lg:block animate-bounce-slow delay-300">
              <div className="w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center text-pink-500">
                <Instagram size={24} />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold text-[#1A1F2C] mb-8 leading-[1.1] tracking-tight">
              Your social media <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2C64E3] to-[#7F56D9]">
                workspace
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Transform your documents into high-performing social content.
              Plan, create, and schedule with AI-powered insights.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <div className="relative w-full sm:w-80">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full px-6 py-4 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm"
                />
              </div>
              <Link
                to="/signup"
                className="w-full sm:w-auto px-10 py-4 bg-[#2C64E3] text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
              >
                Get started for free
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-8 text-sm font-medium text-gray-400">
              <div className="flex items-center gap-2"><Check size={16} /> No credit card required</div>
              <div className="flex items-center gap-2"><Check size={16} /> 14-day free trial</div>
              <div className="flex items-center gap-2"><Check size={16} /> Cancel anytime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="container mx-auto px-6">
          <div className="bg-[#FFF5D9] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FFD567] rounded-full flex items-center justify-center text-[#856404]">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#856404]">Join the Creator Community</h3>
                <p className="text-[#856404] opacity-80">Connect with 100,000+ creators building their brand.</p>
              </div>
            </div>
            <button className="px-6 py-3 bg-[#FFD567] text-[#856404] font-bold rounded-lg hover:bg-[#ffcf4d] transition flex items-center gap-2">
              Learn more <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center">
            <StatItem value="191,726" label="Active Users" />
            <StatItem value="7.8M+" label="Posts Generated" />
            <StatItem value="11" label="Social Channels" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24" id="features">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <FeatureCard
              bgColor="bg-[#FDF2F2]"
              textColor="text-[#9B2C2C]"
              title="Transform Docs into Posts"
              description="Upload any document and our AI will extract the most engaging points for your social media."
              tag="AI CONTENT"
              icon={<FileText />}
              image="/doc-analysis.png"
            />
            <FeatureCard
              bgColor="bg-[#F3F0FF]"
              textColor="text-[#553C9A]"
              title="Plan your perfect week"
              description="Visualize your content calendar and ensure you're consistently reaching your audience."
              tag="SCHEDULING"
              icon={<Calendar />}
              image="/content-calendar.png"
            />
            <FeatureCard
              bgColor="bg-[#FFF8E1]"
              textColor="text-[#975A16]"
              title="Reply to comments in a flash"
              description="Maintain engagement with AI-suggested replies that match your brand voice."
              tag="ENGAGEMENT"
              icon={<Zap />}
              image="/engagement.png"
            />
            <FeatureCard
              bgColor="bg-[#EBF8FF]"
              textColor="text-[#2C5282]"
              title="Analyze, but look analytics"
              description="Deep dive into what's working with beautiful, easy-to-understand performance reports."
              tag="ANALYTICS"
              icon={<BarChart3 />}
              image="/analytics.png"
            />
          </div>
        </div>
      </section>

      {/* Channels Section */}
      <section className="py-24 bg-white" id="channels">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-12">Connect your favorite channels</h2>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <Linkedin size={40} />
            <Twitter size={40} />
            <Instagram size={40} />
            <Facebook size={40} />
            <Github size={40} />
          </div>
        </div>
      </section>

      {/* ...and so much more */}
      <section className="py-24 bg-[#F9F9F9]">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-extrabold mb-16">...and so much more!</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <SmallFeatureCard
              title="Post scheduling"
              description="Schedule all your content at once for the best times to post."
              icon={<Calendar className="text-blue-500" />}
            />
            <SmallFeatureCard
              title="Tailored posts"
              description="Custom posts for each platform from a single document."
              icon={<Sparkles className="text-purple-500" />}
            />
            <SmallFeatureCard
              title="Direct scheduling"
              description="No manual work. Everything goes live automatically."
              icon={<Zap className="text-yellow-500" />}
            />
            <SmallFeatureCard
              title="AI assistance"
              description="Our AI learns your voice and helps you write better posts."
              icon={<FileText className="text-orange-500" />}
            />
          </div>
        </div>
      </section>

      {/* Human Support Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <h2 className="text-4xl font-extrabold mb-6 leading-tight">Human support, worldwide</h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                We're a small, distributed team of enthusiasts here to help you grow.
                Whether you have a question about our features or need help with your strategy,
                we're just a message away.
              </p>
              <div className="flex gap-4">
                <button className="px-6 py-3 bg-[#E1F3DB] text-[#2C6E49] font-bold rounded-lg hover:bg-[#d4edd1] transition">
                  Visit help center
                </button>
                <button className="px-6 py-3 border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition">
                  Talk to us
                </button>
              </div>
            </div>
            <div className="lg:w-1/2 bg-[#F9F9F9] rounded-3xl p-4">
              <img
                src="/team-photo.png"
                alt="Our Team"
                className="w-full h-[400px] object-cover rounded-2xl shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Open Company Section */}
      <section className="py-24">
        <div className="container mx-auto px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-4 block">ABOUT US</span>
          <h2 className="text-4xl font-extrabold mb-6">We are an open company</h2>
          <p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto">
            We believe in transparency and share everything from our roadmap to our diversity reports.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <StatSmall value="191,726" label="TOTAL USERS" />
            <StatSmall value="67,015" label="MONTHLY POSTS" />
            <StatSmall value="79" label="TEAM MEMBERS" />
            <StatSmall value="$22.6M" label="ANNUAL REVENUE" />
          </div>

          <button className="px-8 py-3 border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition flex items-center gap-2 mx-auto">
            Read our blog <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-[#1A1F2C] text-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-6">Loved by thousands of creators</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              See how ContentAI Pro is helping professionals build their brand and engage their audience.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard
              name="Sarah J."
              role="Digital Marketer"
              text="ContentAI Pro has completely transformed my workflow. I can now turn one document into a week's worth of content in minutes!"
            />
            <TestimonialCard
              name="Marcus T."
              role="Tech Founder"
              text="The AI-powered replies are a game-changer. My engagement rate on LinkedIn has doubled since I started using it."
            />
            <TestimonialCard
              name="Elena R."
              role="Content Creator"
              text="I've tried many tools, but none are as intuitive and powerful as this. The scheduling feature is seamless."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-white" id="pricing">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-6">Simple, transparent pricing</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Choose the plan that's right for you. All plans include a 14-day free trial.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <PricingCard
              plan="Free"
              price="0"
              features={["5 AI Generations / mo", "1 Social Account", "Basic Scheduling"]}
              buttonText="Start for free"
            />
            <PricingCard
              plan="Pro"
              price="29"
              features={["50 AI Generations / mo", "3 Social Accounts", "Smart Scheduling", "Detailed Analytics"]}
              highlighted={true}
              buttonText="Try Pro for free"
            />
            <PricingCard
              plan="Business"
              price="99"
              features={["Unlimited Generations", "10 Social Accounts", "Team Collaboration", "Priority Support"]}
              buttonText="Talk to sales"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-[#F9F9F9]">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="text-4xl font-extrabold mb-16 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <FAQItem
              question="How does the document analysis work?"
              answer="Our AI uses advanced NLP to scan your documents, extract the key points, and rewrite them into engaging social media posts tailored for each platform."
            />
            <FAQItem
              question="Which social platforms do you support?"
              answer="Currently, we support LinkedIn, Twitter (X), Facebook, and Instagram. More platforms are being added regularly!"
            />
            <FAQItem
              question="Can I cancel my subscription anytime?"
              answer="Yes, you can cancel your subscription at any time from your settings page. You will still have access until the end of your billing period."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="bg-[#B7EB8F] rounded-3xl p-12 text-center md:py-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#135200] mb-8">
              Grow your social presence <br /> with confidence
            </h2>
            <Link
              to="/signup"
              className="inline-block px-10 py-4 bg-[#135200] text-white rounded-lg font-bold hover:bg-[#092b00] transition shadow-lg"
            >
              Get started for free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2 group cursor-default">
      <span className="text-4xl md:text-5xl font-black text-[#1A1F2C] tracking-tighter group-hover:text-[#2C64E3] transition-colors duration-300">{value}</span>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{label}</span>
      <div className="w-8 h-1 bg-[#2C64E3] mx-auto rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-x-0 group-hover:scale-x-100"></div>
    </div>
  );
}

function FeatureCard({ bgColor, textColor, title, description, tag, icon, image }: {
  bgColor: string;
  textColor: string;
  title: string;
  description: string;
  tag: string;
  icon: React.ReactNode;
  image?: string;
}) {
  return (
    <div className={`${bgColor} rounded-3xl p-8 transition-transform hover:-translate-y-1 duration-300`}>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-6">
          <div className={`p-2 rounded-lg bg-white ${textColor}`}>
            {icon}
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${textColor} opacity-60`}>
            {tag}
          </span>
        </div>
        <h3 className={`text-2xl font-bold mb-4 ${textColor}`}>{title}</h3>
        <p className={`${textColor} opacity-80 leading-relaxed mb-8`}>{description}</p>
        <div className="mt-auto">
          {image ? (
            <img src={image} alt={title} className="w-full h-64 object-cover rounded-xl shadow-md border-4 border-white/50" />
          ) : (
            <div className="w-full h-48 bg-white/50 rounded-xl overflow-hidden shadow-inner flex items-center justify-center text-gray-300 italic text-sm">
              Mockup of {title}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatSmall({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-2xl font-extrabold text-[#1A1F2C]">{value}</span>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function SmallFeatureCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-8 rounded-2xl flex flex-col items-start text-left shadow-sm hover:shadow-md transition duration-300">
      <div className="mb-6 p-3 bg-gray-50 rounded-xl">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-3">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
      <button className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-700 transition flex items-center gap-1">
        Learn more <ArrowRight size={14} />
      </button>
    </div>
  );
}

function TestimonialCard({ name, role, text }: { name: string; role: string; text: string }) {
  return (
    <div className="bg-white/5 p-8 rounded-3xl border border-white/10 hover:bg-white/10 transition duration-300">
      <Quote className="text-blue-400 mb-6 w-8 h-8 opacity-50" />
      <p className="text-gray-300 mb-8 leading-relaxed italic">"{text}"</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-xl font-bold">
          {name[0]}
        </div>
        <div>
          <h4 className="font-bold">{name}</h4>
          <p className="text-sm text-gray-500">{role}</p>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ plan, price, features, highlighted = false, buttonText }: {
  plan: string;
  price: string;
  features: string[];
  highlighted?: boolean;
  buttonText: string;
}) {
  return (
    <div className={`p-8 rounded-3xl border ${highlighted ? 'border-[#2C64E3] shadow-2xl relative scale-105 z-10' : 'border-gray-100 shadow-sm'} bg-white flex flex-col h-full`}>
      {highlighted && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#2C64E3] text-white text-xs font-bold rounded-full">
          MOST POPULAR
        </span>
      )}
      <h3 className="text-xl font-bold mb-2">{plan}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-4xl font-extrabold">${price}</span>
        <span className="text-gray-500 font-medium">/mo</span>
      </div>
      <ul className="space-y-4 mb-8 flex-grow">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
            <Check size={18} className="text-[#2C64E3] flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      <Link to="/signup" className="mt-auto">
        <button className={`w-full py-4 rounded-xl font-bold transition ${highlighted ? 'bg-[#2C64E3] text-white shadow-lg shadow-blue-200 hover:bg-blue-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
          {buttonText}
        </button>
      </Link>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-gray-50 transition"
      >
        <span className="font-bold text-[#1A1F2C]">{question}</span>
        {isOpen ? <Minus size={20} className="text-gray-400" /> : <Plus size={20} className="text-gray-400" />}
      </button>
      {isOpen && (
        <div className="px-8 pb-6 text-gray-600 leading-relaxed text-sm animate-fade-in">
          {answer}
        </div>
      )}
    </div>
  );
}
