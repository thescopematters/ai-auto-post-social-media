import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Footer } from '../components/Footer';

export function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-gray-50/50">
            <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <Link to="/" className="flex items-center space-x-2">
                            <img src="/logo.png" alt="ContentAI Pro" className="w-8 h-8 object-contain" />
                            <span className="text-xl font-bold tracking-tight text-[#1A1F2C]">ContentAI Pro</span>
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="container mx-auto px-6 pt-32 pb-24 max-w-7xl">
                <div className="mb-12">
                    <Link to="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors mb-8 group">
                        <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </Link>

                    <h1 className="text-4xl md:text-5xl font-black text-[#1A1F2C] mb-6 tracking-tight">Privacy Policy</h1>

                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 space-y-12">

                    <div className="prose prose-lg max-w-none text-gray-600">


                        <p>
                            This Privacy Policy describes how your personal information is collected, used, and shared when you visit or use [Your Website URL] (the “Site”) and the services provided through our AI-powered content generation platform (the “Service”).
                        </p>
                    </div>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 1</span>
                            <h2 className="text-2xl font-bold text-gray-900">What do we do with your information?</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                When you sign up or use our Service, we collect personal information such as your name, email address, professional role, and account credentials.
                            </p>
                            <p>
                                When you connect your LinkedIn account, we collect only the information required to generate, schedule, and publish posts on your behalf using LinkedIn’s official APIs.
                            </p>
                            <p className="font-medium text-gray-800">We use the information that we collect to:</p>
                            <ul className="list-disc pl-5 space-y-2 marker:text-blue-500">
                                <li>Create and manage your user account</li>
                                <li>Generate AI-based post ideas, content, and images</li>
                                <li>Allow you to upload documents or write thoughts and convert them into posts</li>
                                <li>Schedule and publish posts to LinkedIn as instructed by you</li>
                                <li>Enforce usage limits based on your subscription plan</li>
                                <li>Communicate with you regarding your account, updates, or support</li>
                                <li>Improve our AI models and platform performance</li>
                                <li>Detect and prevent fraud, misuse, or illegal activity</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 2</span>
                            <h2 className="text-2xl font-bold text-gray-900">Consent</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <h3 className="text-lg font-semibold text-gray-800">How do you get my consent?</h3>
                            <p>
                                When you provide us with personal information to sign up, connect LinkedIn, generate content, schedule posts, or make a payment, you consent to our collecting and using that information for those specific purposes.
                            </p>
                            <p>
                                If we request your information for a secondary purpose, such as marketing communications, we will either ask for your explicit consent or provide you with the option to opt out.
                            </p>
                            <p>
                                You may withdraw your consent at any time by contacting us using the details provided below.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 3</span>
                            <h2 className="text-2xl font-bold text-gray-900">Third-Party Services (AI, Payments & Integrations)</h2>
                        </div>
                        <div className="space-y-6 text-gray-600 leading-relaxed">
                            <p>Our platform relies on trusted third-party services to operate efficiently.</p>

                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">AI Services</h3>
                                <p>
                                    We use third-party AI providers to generate text and images. These providers process data only to the extent necessary to deliver AI-generated output.
                                </p>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Payments</h3>
                                <p className="mb-2">
                                    Payments for paid plans are processed via secure third-party payment gateways (such as Razorpay, Stripe, or similar). We do not store your debit/credit card details.
                                </p>
                                <p>
                                    Payment data is encrypted and handled in compliance with industry security standards.
                                </p>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">LinkedIn Integration</h3>
                                <p className="mb-2">
                                    We use LinkedIn’s official APIs. We only access data that you explicitly authorize and do not access private messages or unrelated account data.
                                </p>
                                <p>
                                    Each third-party service has its own privacy policy, and we encourage you to review them.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 4</span>
                            <h2 className="text-2xl font-bold text-gray-900">Third-Party Links</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                Our Site may contain links to third-party websites or services. Once you leave our Site or are redirected to a third-party platform, you are no longer governed by this Privacy Policy.
                            </p>
                            <p>
                                We are not responsible for the privacy practices of third-party websites.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 5</span>
                            <h2 className="text-2xl font-bold text-gray-900">Security</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                To protect your personal information, we take reasonable precautions and follow industry best practices to ensure your data is not lost, misused, accessed, disclosed, altered, or destroyed.
                            </p>
                            <p className="font-medium text-gray-800">This includes:</p>
                            <ul className="list-disc pl-5 space-y-2 marker:text-green-500">
                                <li>Secure servers</li>
                                <li>Encrypted passwords</li>
                                <li>Restricted access controls</li>
                            </ul>
                            <p className="text-sm italic">
                                However, no method of transmission over the Internet is 100% secure.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 6</span>
                            <h2 className="text-2xl font-bold text-gray-900">AI Usage Disclosure</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>Our platform uses artificial intelligence to generate content and images.</p>
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                                <p className="font-bold text-blue-900 mb-2">You acknowledge and agree that:</p>
                                <ul className="list-disc pl-5 space-y-1 text-blue-800">
                                    <li>AI-generated content may not always be accurate, complete, or compliant with platform policies</li>
                                    <li>All generated content should be reviewed and edited by you before publishing</li>
                                    <li>You are solely responsible for the content you choose to publish on LinkedIn</li>
                                </ul>
                            </div>
                            <p>
                                We do not guarantee the accuracy or suitability of AI-generated output.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 7</span>
                            <h2 className="text-2xl font-bold text-gray-900">Data Retention</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                We retain your personal information only for as long as necessary to provide our services or comply with legal obligations.
                            </p>
                            <p>
                                You may request deletion of your account and associated data at any time.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 8</span>
                            <h2 className="text-2xl font-bold text-gray-900">Your Rights (Indian Law)</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                Under applicable Indian laws, including the Digital Personal Data Protection Act, 2023, you have the right to:
                            </p>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {['Access your personal data', 'Correct inaccurate data', 'Request deletion of your data', 'Withdraw consent'].map((right) => (
                                    <li key={right} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                                        {right}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-4">
                                To exercise these rights, please contact us using the information below.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 9</span>
                            <h2 className="text-2xl font-bold text-gray-900">Changes to this Privacy Policy</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                We reserve the right to modify this Privacy Policy at any time. Changes will take effect immediately upon posting on the Site.
                            </p>
                            <p>
                                If material changes are made, we will notify users through the platform or via email.
                            </p>
                        </div>
                    </section>

                    <section className="pt-8 border-t border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Governing Law & Jurisdiction</h2>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                This Privacy Policy shall be governed and construed in accordance with the laws of India.
                            </p>
                            <p>
                                Any disputes shall be subject to the exclusive jurisdiction of the courts located in [Your City, State], India.
                            </p>
                        </div>
                    </section>

                    <section className="bg-gray-900 text-white p-8 rounded-2xl">
                        <h2 className="text-2xl font-bold mb-4">Questions and Contact Information</h2>
                        <p className="text-gray-300 mb-6">
                            If you would like to access, correct, amend, or delete your personal information, or if you have any questions about this Privacy Policy, please contact us at:
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-start">
                                <span className="font-bold w-24 text-blue-400">Email:</span>
                                <span className="text-gray-200">[your-email@example.com]</span>
                            </div>
                            <div className="flex items-start">
                                <span className="font-bold w-24 text-blue-400">Address:</span>
                                <span className="text-gray-200">[Your Company/Firm Address]</span>
                            </div>
                            <div className="flex items-start">
                                <span className="font-bold w-24 text-blue-400">Country:</span>
                                <span className="text-gray-200">India</span>
                            </div>
                        </div>
                    </section>

                </div>
            </main>
            <Footer />
        </div>
    );
}
