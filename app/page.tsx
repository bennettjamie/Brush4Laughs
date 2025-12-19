"use client";

import Link from "next/link";
import { ArrowRight, Palette, Brush, Sparkles, ShoppingBag, Users, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-indigo-500/30 font-sans overflow-x-hidden">
      {/* Dynamic Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[100px]" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[80px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-8 h-24 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 group cursor-default">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-60 transition-all duration-700 group-hover:scale-125" />
            <img
              src="/brush_only.png"
              alt="Brush4Laughs Logo"
              className="w-16 h-16 object-contain relative transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-white dark:to-slate-400">
              Brush4Laughs
            </span>
            <span className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 -mt-1 ml-0.5">Studio Edition</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
          <a href="#benefits" className="hover:text-foreground transition-colors">Our Community</a>
          <Link href="/create" className="px-5 py-2.5 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-full text-foreground transition-all backdrop-blur-sm">
            Launch Creator
          </Link>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="px-6 pt-20 pb-32 text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-sm font-black uppercase tracking-[0.2em] mb-10"
          >
            <Sparkles className="w-4 h-4" />
            <span>Memories Reimagined</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-6xl md:text-9xl font-black tracking-tighter leading-[1.1] md:leading-[0.85] mb-10 bg-clip-text text-transparent bg-gradient-to-b from-slate-950 via-slate-800 to-slate-600 dark:from-white dark:via-white dark:to-white/60"
          >
            Turn Your Moments<br /> Into Masterpieces.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="text-xl md:text-3xl text-muted-foreground dark:text-slate-100 max-w-3xl mx-auto mb-12 leading-relaxed font-medium"
          >
            From snapshots to canvases—learn the art of painting while creating art you love.
            Our <b>Custom Canvas Creator</b> transforms your favorite photos into professional kits.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Link
              href="/create"
              className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-2xl text-xl font-bold shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.6)] hover:-translate-y-1 transition-all active:translate-y-0 active:scale-[0.98]"
            >
              <Brush className="w-6 h-6" />
              <span>Start Your Canvas</span>
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </section>

        {/* Features / Value Props Section */}
        <section id="benefits" className="px-6 py-32 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ValueCard
              icon={<Palette className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />}
              title="Artistic Interpretation"
              description="Our system doesn’t just copy; it interprets. We preserve the soul of your memory while optimizing it for a professional painting experience."
            />
            <ValueCard
              icon={<ShoppingBag className="w-8 h-8 text-violet-600 dark:text-violet-400" />}
              title="Pro-Grade Supplies"
              description="Learn by using what the masters use. We guide you to purchase your materials from the exact shops local professional artists trust."
            />
            <ValueCard
              icon={<Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />}
              title="Artist Community"
              description="Meet local artists and join a global network of painters. Benefit from professional-grade quality and affordability while you learn and grow."
            />
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="px-6 py-32 bg-foreground/5 border-y border-foreground/5 relative overflow-hidden text-center ">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px] -z-10" />

          <h2 className="text-3xl md:text-5xl font-bold mb-20">Simple. Artistic. Personal.</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 max-w-6xl mx-auto text-left">
            <Step
              number="01"
              title="Upload Your Snapshot"
              desc="Choose a photo that moves you. Our creator analyzes lighting and detail to build your map."
            />
            <Step
              number="02"
              title="Review Your Canvas"
              desc="Customize size and complexity. We generate a custom palette and outline made just for your memory."
            />
            <Step
              number="03"
              title="Print & Paint"
              desc="Download your pro-grade guide, grab your artist-recommended brushes, and begin your journey."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-20 border-t border-foreground/5">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center gap-2">
                <img src="/brush_only.png" alt="" className="w-6 h-6 grayscale opacity-50" />
                <span className="text-lg font-bold text-muted-foreground dark:text-white/40">Brush4Laughs</span>
              </div>
              <p className="text-slate-500 text-sm">Bring your memories to life. One brushstroke at a time.</p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2 text-sm text-slate-500">
              <p>&copy; {new Date().getFullYear()} Brush4Laughs. All rights reserved.</p>
              <div className="flex gap-6 mt-2">
                <a href="#" className="hover:text-foreground">Privacy</a>
                <a href="#" className="hover:text-foreground">Terms</a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function ValueCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="group relative p-10 rounded-[2rem] glass hover:bg-foreground/[0.04] transition-all duration-500 hover:-translate-y-2">
      <div className="mb-8 p-4 bg-foreground/5 rounded-2xl w-fit group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all duration-500">
        {icon}
      </div>
      <h3 className="text-3xl font-black mb-6 text-foreground tracking-tight">{title}</h3>
      <p className="text-muted-foreground dark:text-slate-100 leading-relaxed text-2xl font-medium">{description}</p>

      {/* Decorative Shimmer */}
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}

function Step({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="relative space-y-6 group">
      <div className="text-6xl font-black text-foreground/5 group-hover:text-indigo-500/10 transition-colors duration-500 select-none">
        {number}
      </div>
      <div className="space-y-3">
        <h4 className="text-xl font-bold text-foreground flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-indigo-500" />
          {title}
        </h4>
        <p className="text-muted-foreground dark:text-slate-200 leading-relaxed text-xl font-medium">
          {desc}
        </p>
      </div>
    </div>
  )
}
