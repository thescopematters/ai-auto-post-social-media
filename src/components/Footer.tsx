import { Link } from 'react-router-dom';
import { Sparkles, Twitter, Linkedin, Instagram } from 'lucide-react';

export function Footer() {
    return (
        <footer className="bg-[#1A1F2C] text-white py-20">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 mb-16">
                    <div className="col-span-2">
                        <div className="flex items-center space-x-2 mb-6">
                            <Sparkles className="text-blue-400" />
                            <span className="text-2xl font-bold">ContentAI Pro</span>
                        </div>
                        <p className="text-gray-400 max-w-xs mb-8">
                            The ultimate AI-powered workspace for social media professionals and creators.
                        </p>
                        <div className="flex gap-4">
                            <Twitter className="w-5 h-5 text-gray-400 hover:text-white cursor-pointer" />
                            <Linkedin className="w-5 h-5 text-gray-400 hover:text-white cursor-pointer" />
                            <Instagram className="w-5 h-5 text-gray-400 hover:text-white cursor-pointer" />
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold mb-6 text-sm uppercase tracking-wider">Product</h4>
                        <ul className="space-y-4 text-gray-400 text-sm">
                            <li><a href="#" className="hover:text-white transition">Features</a></li>
                            <li><a href="#" className="hover:text-white transition">Integrations</a></li>
                            <li><a href="#" className="hover:text-white transition">Pricing</a></li>
                            <li><a href="#" className="hover:text-white transition">Changelog</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold mb-6 text-sm uppercase tracking-wider">Resources</h4>
                        <ul className="space-y-4 text-gray-400 text-sm">
                            <li><a href="#" className="hover:text-white transition">Documentation</a></li>
                            <li><a href="#" className="hover:text-white transition">Blog</a></li>
                            <li><a href="#" className="hover:text-white transition">Support</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold mb-6 text-sm uppercase tracking-wider">Company</h4>
                        <ul className="space-y-4 text-gray-400 text-sm">
                            <li><a href="#" className="hover:text-white transition">About</a></li>
                            <li><a href="#" className="hover:text-white transition">Careers</a></li>
                            <li><Link to="/privacy" className="hover:text-white transition">Privacy</Link></li>
                            <li><Link to="/terms" className="hover:text-white transition">Terms</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} ContentAI Pro. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
