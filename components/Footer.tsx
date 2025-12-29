import { Heart, Mail, Facebook, Instagram } from "lucide-react";

export function Footer() {
    return (
        <footer className="relative bg-slate-900 border-t border-white/10 text-slate-300 py-16 mt-20 overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-1/4 w-1/2 h-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

            <div className="max-w-6xl mx-auto px-6 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

                {/* Story Section */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                            <Heart className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight">A Family Tradition</h3>
                    </div>

                    <div className="space-y-4 text-base leading-relaxed text-slate-400">
                        <p>
                            It started as a simple holiday tradition: <strong>"Make a Gift"</strong>. Every year, my family challenges each other to create something handmade for the holidays.
                        </p>
                        <p>
                            I initially wanted to make a single paint-by-number kit, but I realized I wanted more. I wanted us to be able to take our favorite family memories from our trips and transform them into paintings together.
                        </p>
                        <p>
                            The goal wasn't just to learn how to paint, but to seize a rare opportunity to slow down and spend real time together in our busy lives.
                        </p>
                        <p className="font-medium text-indigo-200">
                            I hope this tool helps you do the same with your loved ones.
                        </p>
                        <p className="italic text-slate-500 text-sm mt-4">— Jamie</p>
                    </div>
                </div>

                {/* Contact Section */}
                <div className="flex flex-col md:items-end space-y-8">
                    <div className="glass p-8 rounded-3xl bg-white/5 border border-white/10 shadow-xl backdrop-blur-sm max-w-sm w-full">
                        <h4 className="text-white font-bold mb-6 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-400" />
                            Get in Touch
                        </h4>

                        <div className="space-y-4">
                            <div>
                                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Founder</div>
                                <a href="mailto:jamie@brush4laughs.com" className="text-indigo-300 hover:text-white transition-colors font-mono">
                                    jamie@brush4laughs.com
                                </a>
                            </div>

                            <div className="w-full h-px bg-white/10" />

                            <div>
                                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Feedback & Support</div>
                                <a href="mailto:feedback@brush4laughs.com" className="text-indigo-300 hover:text-white transition-colors font-mono">
                                    feedback@brush4laughs.com
                                </a>
                            </div>

                            <div className="w-full h-px bg-white/10" />

                            <div>
                                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Community & Social</div>
                                <div className="space-y-3">
                                    <a href="/community" className="block text-indigo-300 hover:text-white transition-colors">
                                        Our Community
                                    </a>

                                    <div className="flex items-center gap-4">
                                        {/* Facebook */}
                                        <a
                                            href="https://facebook.com/brush4laughs"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-10 h-10 rounded-full bg-white/5 hover:bg-indigo-600 flex items-center justify-center transition-all group"
                                            aria-label="Facebook"
                                        >
                                            <Facebook className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                                        </a>

                                        {/* Instagram */}
                                        <a
                                            href="https://instagram.com/brush4laughs"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-10 h-10 rounded-full bg-white/5 hover:bg-pink-600 flex items-center justify-center transition-all group"
                                            aria-label="Instagram"
                                        >
                                            <Instagram className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                                        </a>

                                        {/* TikTok */}
                                        <a
                                            href="https://tiktok.com/@brush4laughs"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-10 h-10 rounded-full bg-white/5 hover:bg-black flex items-center justify-center transition-all group"
                                            aria-label="TikTok"
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors"
                                            >
                                                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-slate-600 font-medium">
                        © {new Date().getFullYear()} Brush4Laughs. All rights reserved.
                    </div>
                </div>
            </div>
        </footer>
    );
}
