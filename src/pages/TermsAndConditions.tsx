import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Footer } from '../components/Footer';

export function TermsAndConditions() {
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

                    <h1 className="text-4xl md:text-5xl font-black text-[#1A1F2C] mb-6 tracking-tight">Terms and Conditions</h1>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 space-y-12">

                    <div className="prose prose-lg max-w-none text-gray-600">
                        <p className="lead text-xl text-gray-700 font-medium">
                            These Terms and Conditions ("Terms") govern your access to and use of <strong>[Your App Name]</strong> (the "Platform", "Service", "we", "our", or "us"), an AI-powered platform that enables users to generate, edit, schedule, and publish LinkedIn posts.
                        </p>
                        <p>
                            By accessing or using our Platform, you agree to be bound by these Terms. If you do not agree, please do not use the Service.
                        </p>
                    </div>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 1</span>
                            <h2 className="text-2xl font-bold text-gray-900">Eligibility & Online Platform Terms</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>By agreeing to these Terms, you confirm that:</p>
                            <ul className="list-disc pl-5 space-y-2 marker:text-blue-500">
                                <li>You are at least 18 years old, or the age of majority under applicable Indian law</li>
                                <li>You have the legal authority to connect and manage a LinkedIn account</li>
                            </ul>
                            <p>
                                You may not use the Platform for any illegal, unauthorized, or unlawful purpose, nor may you violate any applicable laws, including intellectual property or platform-specific rules (such as LinkedIn policies).
                            </p>
                            <p>
                                Any violation of these Terms may result in immediate suspension or termination of your account.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 2</span>
                            <h2 className="text-2xl font-bold text-gray-900">General Conditions</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                We reserve the right to refuse service to anyone for any reason at any time.
                            </p>
                            <p>
                                You understand that your content (excluding payment information) may be transmitted over various networks and adapted to technical requirements. Payment-related information is always handled securely through encrypted third-party gateways.
                            </p>
                            <p>
                                You agree not to copy, reproduce, sell, resell, or exploit any portion of the Platform without our prior written permission.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 3</span>
                            <h2 className="text-2xl font-bold text-gray-900">Accuracy of Information</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                Content generated by the Platform, including AI-generated posts and images, is provided for general assistance only.
                            </p>
                            <p>
                                We do not guarantee that any content generated through AI will be accurate, complete, current, or compliant with LinkedIn or other third-party policies. You acknowledge that reliance on such content is entirely at your own risk.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 4</span>
                            <h2 className="text-2xl font-bold text-gray-900">Modifications to the Service & Pricing</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                We reserve the right to modify, suspend, or discontinue any part of the Platform at any time without notice.
                            </p>
                            <p>
                                Subscription prices, features, and usage limits may change from time to time. We shall not be liable for any modification, price change, or discontinuation of the Service.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 5</span>
                            <h2 className="text-2xl font-bold text-gray-900">Subscription Plans & Services</h2>
                        </div>
                        <div className="space-y-6 text-gray-600 leading-relaxed">
                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Free Plan</h3>
                                <ul className="list-disc pl-5 space-y-2 marker:text-green-500">
                                    <li>Limited features</li>
                                    <li>Maximum of <strong>2 published LinkedIn posts per week</strong></li>
                                </ul>
                            </div>
                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Paid Plan</h3>
                                <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                                    <li>Enhanced features</li>
                                    <li>Maximum of <strong>100 published LinkedIn posts per week</strong></li>
                                </ul>
                            </div>
                            <p>
                                Plan limits are enforced automatically. Abuse or circumvention of limits may result in suspension.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 6</span>
                            <h2 className="text-2xl font-bold text-gray-900">Billing & Account Information</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                You agree to provide accurate, complete, and up-to-date account and billing information.
                            </p>
                            <p>
                                Payments are processed via secure third-party payment gateways. We do not store your card or banking details.
                            </p>
                            <p>
                                Subscription fees are non-refundable unless otherwise stated.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 7</span>
                            <h2 className="text-2xl font-bold text-gray-900">AI Tools & Optional Features</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                The Platform provides access to AI-powered tools for content and image generation.
                            </p>
                            <p>
                                These tools are provided on an "as is" and "as available" basis, without warranties of any kind. We do not guarantee performance, engagement, reach, or business outcomes from AI-generated content.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 8</span>
                            <h2 className="text-2xl font-bold text-gray-900">Third-Party Services & Links</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                The Platform integrates with third-party services including LinkedIn, AI providers, payment processors, and cloud services.
                            </p>
                            <p>
                                We are not responsible for third-party services, websites, or their policies. Use of third-party services is governed by their respective terms and policies.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 9</span>
                            <h2 className="text-2xl font-bold text-gray-900">User Content & Feedback</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                You retain ownership of the content you create or upload.
                            </p>
                            <p>
                                By using the Platform, you grant us a limited license to process, store, and use your content solely for providing the Service.
                            </p>
                            <p>
                                You agree not to upload or generate content that is unlawful, offensive, misleading, defamatory, or violates any third-party rights.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 10</span>
                            <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                Your use of the Platform and submission of personal data are governed by our <strong>Privacy Policy</strong>.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 11</span>
                            <h2 className="text-2xl font-bold text-gray-900">Errors & Service Availability</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                We reserve the right to correct errors, inaccuracies, or omissions and to update or cancel services if information is inaccurate at any time without prior notice.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 12</span>
                            <h2 className="text-2xl font-bold text-gray-900">Prohibited Uses</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>You agree not to:</p>
                            <ul className="list-disc pl-5 space-y-2 marker:text-red-500">
                                <li>Use the Platform for illegal or fraudulent purposes</li>
                                <li>Violate LinkedIn’s terms or community guidelines</li>
                                <li>Upload copyrighted material without authorization</li>
                                <li>Misuse AI tools to generate harmful, misleading, or abusive content</li>
                                <li>Attempt to bypass usage limits or security features</li>
                            </ul>
                            <p>
                                Violation may result in termination of access.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 13</span>
                            <h2 className="text-2xl font-bold text-gray-900">Disclaimer of Warranties & Limitation of Liability</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                The Platform is provided "as is" and "as available" without warranties of any kind.
                            </p>
                            <p>
                                We do not guarantee uninterrupted, secure, or error-free operation.
                            </p>
                            <p>
                                To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, consequential, or special damages, including loss of data, revenue, business, or LinkedIn account access.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 14</span>
                            <h2 className="text-2xl font-bold text-gray-900">Indemnification</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                You agree to indemnify and hold harmless <strong>[Your App Name]</strong>, its founders, employees, and partners from any claims arising from your misuse of the Platform, violation of these Terms, or breach of applicable laws.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 15</span>
                            <h2 className="text-2xl font-bold text-gray-900">Severability</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                If any provision of these Terms is held unenforceable, the remaining provisions shall remain in full force and effect.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 16</span>
                            <h2 className="text-2xl font-bold text-gray-900">Termination</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                You may terminate your account at any time.
                            </p>
                            <p>
                                We may suspend or terminate access immediately if you violate these Terms or misuse the Service. Obligations incurred prior to termination shall survive.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 17</span>
                            <h2 className="text-2xl font-bold text-gray-900">Entire Agreement</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                These Terms, along with the Privacy Policy, constitute the entire agreement between you and us regarding use of the Platform.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 18</span>
                            <h2 className="text-2xl font-bold text-gray-900">Governing Law & Jurisdiction</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                These Terms shall be governed by and construed in accordance with the laws of India.
                            </p>
                            <p>
                                Courts located in <strong>[Your City, State], India</strong> shall have exclusive jurisdiction.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <span className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1 block">Section 19</span>
                            <h2 className="text-2xl font-bold text-gray-900">Changes to Terms</h2>
                        </div>
                        <div className="space-y-4 text-gray-600 leading-relaxed">
                            <p>
                                We reserve the right to update or modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance.
                            </p>
                        </div>
                    </section>

                    <section className="bg-gray-900 text-white p-8 rounded-2xl">
                        <h2 className="text-2xl font-bold mb-4">Section 20 - Contact Information</h2>
                        <p className="text-gray-300 mb-6">
                            For questions regarding these Terms:
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-start">
                                <span className="font-bold w-24 text-blue-400">Email:</span>
                                <span className="text-gray-200">[your-email@example.com]</span>
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
