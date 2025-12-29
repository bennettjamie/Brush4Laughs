
import { Upload, Users } from "lucide-react";

export default function CommunityPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-200 py-24 px-6">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/10 mb-4">
                        <Users className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Our Community
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Join thousands of creators sharing their paint-by-number masterpieces.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    <div className="glass p-8 rounded-3xl bg-white/5 border border-white/10 shadow-xl backdrop-blur-sm">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-6">
                            <Upload className="w-6 h-6 text-indigo-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-4">Share Your Work</h2>
                        <p className="text-slate-400 mb-6 leading-relaxed">
                            Finished a painting? We'd love to see it! Share your creation with us on social media or send it directly.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <a
                                href="https://facebook.com/brush4laughs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                            >
                                Share on Facebook
                            </a>
                            <a
                                href="https://instagram.com/brush4laughs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium transition-colors"
                            >
                                Share on Instagram
                            </a>
                        </div>
                    </div>

                    <div className="glass p-8 rounded-3xl bg-white/5 border border-white/10 shadow-xl backdrop-blur-sm">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-6">
                            <Users className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-4">Join the Conversation</h2>
                        <p className="text-slate-400 mb-6 leading-relaxed">
                            Follow us for tips, tricks, and daily inspiration from other artists in our community.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>Weekly features</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>Artist spotlights</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>Exclusive giveaways</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
