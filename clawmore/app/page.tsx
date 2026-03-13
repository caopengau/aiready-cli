'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Zap,
  RefreshCcw,
  ShieldCheck,
  Cpu,
  GitBranch,
  Globe,
  MessageSquare,
  ArrowRight,
  Code,
  Terminal,
  Layers,
  Activity,
} from 'lucide-react';
import Modal from '../components/Modal';
import LeadForm from '../components/LeadForm';

export default function ClawMorePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'beta' | 'waitlist'>('beta');

  const openModal = (type: 'beta' | 'waitlist') => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-cyber-blue/30 selection:text-cyber-blue font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="ClawMore Logo"
              width={40}
              height={40}
              className="drop-shadow-[0_0_12px_rgba(0,224,255,0.8)]"
            />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight leading-none glow-text">
                ClawMore
              </span>
              <span className="text-[8px] font-mono text-cyber-purple uppercase tracking-[0.2em] mt-0.5">
                Neural_Node_v1.0
              </span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-10 text-[11px] font-mono uppercase tracking-widest text-zinc-500">
            <Link
              href="#features"
              className="hover:text-cyber-blue transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3 h-3" /> Features
            </Link>
            <Link
              href="#evolution"
              className="hover:text-cyber-blue transition-colors flex items-center gap-1.5"
            >
              <RefreshCcw className="w-3 h-3" /> Evolution
            </Link>
            <Link
              href="#pricing"
              className="hover:text-cyber-blue transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-3 h-3" /> Pricing
            </Link>
            <div className="flex items-center gap-4 pl-4 border-l border-white/10">
              <Link
                href="https://github.com/caopengau/serverlessclaw"
                className="px-4 py-2 rounded-sm bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-2 border border-white/10"
              >
                <Code className="w-3 h-3" /> Source
              </Link>
              <div className="flex items-center gap-2 px-3 py-2 bg-cyber-blue/5 border border-cyber-blue/20 rounded-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-pulse" />
                <span className="text-cyber-blue text-[9px] font-black">
                  LINK_ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative min-h-[100vh] flex flex-col items-center justify-center overflow-hidden border-b border-white/5 isolate py-20">
        {/* Cinematic Background Image - STACKING FIX & MAXIMUM IMPACT */}
        <div className="absolute inset-0 -z-10 bg-[#0a0a0a]">
          <Image
            src="/hero.png"
            alt="Hero Background"
            fill
            className="object-cover blur-[1px] brightness-[0.65] saturate-[0.8]"
            priority
          />
          {/* Subtle Vignette to protect text while keeping edges vibrant */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(10,10,10,0.6)_40%,_#0a0a0a_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-[#0a0a0a] opacity-80" />
        </div>

        <div className="container mx-auto px-4 relative flex flex-col items-center text-center">
          {/* Intensified Lighting Halo to lift content from background */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_rgba(0,224,255,0.15)_0%,_transparent_70%)] blur-3xl opacity-50" />

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-sm border border-cyber-blue/40 bg-cyber-blue/10 text-cyber-blue text-[10px] font-mono uppercase tracking-[0.3em] mb-12 shadow-[0_0_30px_rgba(0,224,255,0.15)] backdrop-blur-sm">
            <Activity className="w-3 h-3" />
            <span>Autonomous Infrastructure Synthesis</span>
          </div>

          {/* Cache-buster: v2-gradient */}
          <h1 className="text-6xl md:text-9xl font-black tracking-tighter mb-10 bg-gradient-to-r from-[#00e0ff] to-[#bc00ff] bg-clip-text text-transparent leading-[1.2] pb-4 drop-shadow-[0_10px_60px_rgba(0,0,0,1)]">
            Never-Dying,
            <br />
            <span className="italic">Self-Evolving</span> Claw
          </h1>

          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-14 leading-relaxed font-light drop-shadow-[0_2px_10px_rgba(0,0,0,1)]">
            <span className="text-cyber-blue font-bold">Serverless</span>, but{' '}
            <span className="text-cyber-purple font-bold">ClawMore!</span> We
            interpret intent and persist infrastructure mutations to source
            control while you sleep.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <button
              onClick={() => openModal('beta')}
              className="px-12 py-5 rounded-sm bg-white text-black hover:bg-cyber-blue transition-all font-black uppercase tracking-widest flex items-center gap-3 group shadow-[0_0_50px_rgba(255,255,255,0.2)]"
            >
              Managed Beta Access
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => openModal('waitlist')}
              className="px-12 py-5 rounded-sm border border-white/20 bg-white/5 hover:bg-white/10 transition-all font-bold uppercase tracking-widest text-[14px] backdrop-blur-md"
            >
              Join the Waitlist
            </button>
          </div>
        </div>
      </section>

      {/* Lead Generation Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <LeadForm type={modalType} onSuccess={closeModal} />
      </Modal>

      {/* Core Pillars */}
      <section className="py-24 relative" id="features">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_transparent,_rgba(0,255,163,0.02),_transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-10 hover:border-cyber-blue/30 transition-all group">
              <div className="w-14 h-14 rounded-sm bg-cyber-blue/10 flex items-center justify-center text-cyber-blue mb-8 border border-cyber-blue/20 group-hover:scale-110 transition-transform">
                <RefreshCcw className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 tracking-tight">
                Autonomous Evolution
              </h3>
              <p className="text-zinc-500 leading-relaxed text-sm">
                Recursive Git-driven loops that close the gap between reasoning
                and code. The system monitors its own performance logs and
                triggers{' '}
                <span className="text-zinc-300">
                  Self-Correction Requests (SCR)
                </span>{' '}
                autonomously.
              </p>
            </div>

            <div className="glass-card p-10 hover:border-purple-500/30 transition-all group">
              <div className="w-14 h-14 rounded-sm bg-purple-500/10 flex items-center justify-center text-purple-400 mb-8 border border-purple-500/20 group-hover:scale-110 transition-transform">
                <Cpu className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 tracking-tight">
                Neural Spine
              </h3>
              <p className="text-zinc-500 leading-relaxed text-sm">
                Architected on AWS EventBridge for decoupled agent coordination.
                Stateless execution with{' '}
                <span className="text-purple-400 font-mono text-[10px] uppercase tracking-tighter">
                  Unlimited_Breadth
                </span>{' '}
                via the ClawFlow mesh.
              </p>
            </div>

            <div className="glass-card p-10 hover:border-cyber-purple/30 transition-all group">
              <div className="w-14 h-14 rounded-sm bg-cyber-purple/10 flex items-center justify-center text-cyber-purple mb-8 border border-cyber-purple/20 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 tracking-tight">
                Ironclad BYOC
              </h3>
              <p className="text-zinc-500 leading-relaxed text-sm">
                Keep your neural weight in your own VPC. Deploy with strict{' '}
                <span className="text-cyber-purple">Recursion Guards</span> and
                Human-in-the-Loop context isolation for enterprise safety.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Evolution Loop Visual */}
      <section
        className="py-24 bg-black/40 border-y border-white/5 relative overflow-hidden"
        id="evolution"
      >
        <div className="container mx-auto px-4 relative">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1">
              <div className="text-cyber-blue font-mono text-[10px] uppercase tracking-[0.4em] mb-4">
                Core_Process_Visualizer
              </div>
              <h2 className="text-5xl font-black mb-8 tracking-tighter italic">
                The Mutation Cycle
              </h2>
              <p className="text-zinc-400 mb-10 leading-relaxed text-lg font-light">
                Standard agents are transient. ClawMore treats its primary logic
                as <span className="text-white italic">Mutable State</span>.
                When a capability gap is detected, the Planner sintetizes a
                patch and the Coder commits it directly to the monorepo branch.
              </p>

              <div className="space-y-4">
                {[
                  {
                    label: 'GAP_DETECTION',
                    desc: 'Reflector identifies functional deficiencies',
                    color: 'cyber-blue',
                  },
                  {
                    label: 'SYNTHESIS_PLAN',
                    desc: 'Architect designs the mutation path',
                    color: 'purple-400',
                  },
                  {
                    label: 'EXECUTION_OPS',
                    desc: 'Coder implements & SST Ion deploys infra',
                    color: 'cyber-blue',
                  },
                  {
                    label: 'GIT_PERSISTENCE',
                    desc: 'Verified code is merged back to main',
                    color: 'white',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex gap-6 p-5 rounded-sm border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                  >
                    <div className="text-zinc-600 font-mono text-sm group-hover:text-cyber-blue transition-colors">
                      0{idx + 1}
                    </div>
                    <div>
                      <div className="font-black text-xs uppercase tracking-widest mb-1">
                        {item.label}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono tracking-tight">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 relative w-full aspect-square max-w-[550px] group">
              <div className="absolute inset-0 bg-cyber-blue/10 rounded-full blur-[100px] animate-pulse group-hover:bg-cyber-blue/20 transition-all" />
              <div className="relative h-full w-full rounded-sm border border-white/10 bg-[#060606] p-8 font-mono text-[11px] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyber-blue" />
                    <span className="text-white font-bold tracking-tighter uppercase">
                      Evolution_Stream.log
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500/50" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                    <div className="w-2 h-2 rounded-full bg-cyber-blue/50" />
                  </div>
                </div>
                <div className="space-y-3 leading-relaxed">
                  <div className="text-zinc-600 font-bold">
                    [01:14:16]{' '}
                    <span className="text-cyber-blue uppercase">
                      Node_Status:
                    </span>{' '}
                    SYNCHRONIZED
                  </div>
                  <div className="text-zinc-600 font-bold">
                    [01:14:17]{' '}
                    <span className="text-purple-400 uppercase">Process:</span>{' '}
                    Scoped Gap Analysis initiated...
                  </div>
                  <div className="pl-4 text-zinc-500 italic">
                    {'>>'} Identified deficiency in AdaptiveRateLimiters
                  </div>
                  <div className="text-zinc-600 font-bold">
                    [01:14:22]{' '}
                    <span className="text-yellow-400 uppercase">Action:</span>{' '}
                    Synthesizing patch v4.2.9
                  </div>
                  <div className="text-zinc-600 font-bold">
                    [01:14:35]{' '}
                    <span className="text-white uppercase">Ops:</span> Mutation
                    in progress (infra/limits.ts)
                  </div>
                  <div className="text-zinc-600 font-bold">
                    [01:15:02]{' '}
                    <span className="text-cyber-blue uppercase">Sync:</span>{' '}
                    Committing success to origin/main
                  </div>

                  <div className="mt-8 p-4 bg-cyber-blue/5 rounded-sm border border-cyber-blue/20 text-cyber-blue text-[10px] relative overflow-hidden group-hover:border-cyber-blue/40 transition-all">
                    <div className="absolute top-0 right-0 p-1 opacity-20">
                      <Zap size={40} />
                    </div>
                    <div className="font-black mb-1 text-white underline decoration-cyber-blue decoration-2 underline-offset-4">
                      MUTATION_VERIFIED
                    </div>
                    <div>+ infra: added JIT concurrency scaling</div>
                    <div className="text-[8px] opacity-60 mt-2">
                      HASH: 5086da9f3c6d8e2d494195...
                    </div>
                  </div>
                </div>
                {/* Scanline Effect */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_2px,3px_100%]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32" id="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <div className="text-cyber-purple font-mono text-[9px] uppercase tracking-[0.5em] mb-4">
              Sustenance_Model
            </div>
            <h2 className="text-5xl font-black mb-6 tracking-tighter italic">
              Transparent Resource Alloc
            </h2>
            <p className="text-zinc-500 font-mono text-[11px] uppercase tracking-widest font-bold">
              Pay for successful mutations only.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mx-auto">
            {/* Free Tier - STYLISH & EQUAL */}
            <div className="glass-card p-10 flex flex-col border-cyber-purple/20 bg-cyber-purple/[0.02] hover:border-cyber-purple/40 transition-all shadow-[0_0_80px_rgba(188,0,255,0.05)]">
              <div className="mb-10">
                <h4 className="text-cyber-purple font-mono text-[9px] uppercase tracking-widest font-black mb-2">
                  Community_Node
                </h4>
                <div className="text-5xl font-black tracking-tight text-white">
                  $0
                </div>
                <p className="text-[10px] font-mono text-cyber-purple uppercase mt-4 tracking-tighter">
                  Self-Hosted Perpetual License
                </p>
              </div>
              <ul className="space-y-5 mb-12 flex-grow">
                <li className="flex items-center gap-3 text-xs text-zinc-200 font-mono uppercase tracking-tight">
                  <ShieldCheck className="w-4 h-4 text-cyber-purple" /> OSS Core
                  Engine
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-200 font-mono uppercase tracking-tight">
                  <GitBranch className="w-4 h-4 text-cyber-purple" /> Basic
                  Archetypes
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-200 font-mono uppercase tracking-tight">
                  <Globe className="w-4 h-4 text-cyber-purple" /> BYOK Only
                </li>
              </ul>
              <Link
                href="https://github.com/caopengau/serverlessclaw"
                className="w-full py-4 rounded-sm border border-cyber-purple/30 text-center hover:bg-cyber-purple/10 transition-all text-[10px] font-black uppercase tracking-widest text-cyber-purple shadow-[0_0_15px_rgba(188,0,255,0.1)]"
              >
                Fork_Repository
              </Link>
            </div>

            {/* Pro Tier - EQUAL SCALE */}
            <div className="glass-card p-10 border-cyber-blue/30 bg-cyber-blue/[0.02] relative flex flex-col hover:border-cyber-blue/50 transition-all shadow-[0_0_80px_rgba(0,224,255,0.05)]">
              <div className="absolute top-0 right-10 -translate-y-1/2 px-4 py-1.5 rounded-sm bg-cyber-blue text-black text-[9px] font-black uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(0,224,255,0.3)]">
                MANAGED
              </div>
              <div className="mb-10">
                <h4 className="text-cyber-blue font-mono text-[9px] uppercase tracking-widest font-black mb-2">
                  Managed_Core
                </h4>
                <div className="text-5xl font-black tracking-tight text-white">
                  $29
                  <span className="text-xl font-normal text-zinc-600">/mo</span>
                </div>
                <p className="text-[10px] font-mono text-cyber-blue uppercase mt-4 tracking-tighter">
                  Infrastructure + Cloud Ops
                </p>
              </div>
              <ul className="space-y-5 mb-12 flex-grow">
                <li className="flex items-center gap-3 text-xs text-zinc-200 font-mono uppercase tracking-tight">
                  <Zap className="w-4 h-4 text-cyber-blue" /> Remote Dashboard
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-200 font-mono uppercase tracking-tight">
                  <RefreshCcw className="w-4 h-4 text-cyber-blue" />{' '}
                  Auto-Mutation Sync
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-200 font-mono uppercase tracking-tight">
                  <MessageSquare className="w-4 h-4 text-cyber-blue" /> Priority
                  Feedback Loop
                </li>
              </ul>
              <Link
                href="#waitlist"
                className="w-full py-4 rounded-sm bg-cyber-blue hover:bg-cyber-blue/90 transition-all text-black text-[10px] font-black uppercase text-center tracking-widest shadow-[0_0_20px_rgba(0,224,255,0.2)]"
              >
                Join Waitlist
              </Link>
            </div>
          </div>

          <div className="mt-20 glass-card p-8 max-w-2xl mx-auto border-cyber-purple/20 bg-cyber-purple/[0.02]">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-4 h-4 text-cyber-purple" />
              <h5 className="font-mono text-[10px] font-black uppercase tracking-[0.4em] text-cyber-purple">
                The Evolution_Tax.cfg
              </h5>
            </div>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed tracking-tight">
              We align our success with your system&apos;s growth. We deduct{' '}
              <span className="text-white font-bold">
                $1 per verified mutation
              </span>{' '}
              (an autonomous commit that successfully passes all CI/CD gates).
              Stagnant systems pay zero.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-black/40">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-4 mb-10">
            <Image
              src="/logo.png"
              alt="ClawMore Logo"
              width={32}
              height={32}
              className="rounded-sm opacity-80"
            />
            <span className="font-black text-xl tracking-tighter italic glow-text">
              ClawMore
            </span>
          </div>
          <div className="text-zinc-600 text-[10px] font-mono uppercase tracking-[0.3em] font-bold">
            Part of the{' '}
            <Link
              href="https://getaiready.dev"
              className="text-zinc-400 hover:text-cyber-blue transition-colors underline decoration-white/10 underline-offset-4"
            >
              AIReady_Ecosystem
            </Link>{' '}
            neural network.
            <div className="mt-6 opacity-40">
              © 2026 PERPETUAL_EVOLUTION. TERMINAL_LOCKED.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
