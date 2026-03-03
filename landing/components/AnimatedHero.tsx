'use client';

'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import AgentPrompt from './AgentPrompt';
import {
  Rocket,
  Package,
  Terminal,
  Bot,
  Code2,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

const words = ['AI-Ready', 'Model-Aware', 'Agentic', 'ROI-Driven'];

export default function AnimatedHero() {
  const [currentWord, setCurrentWord] = useState(0);
  const [activeTab, setActiveTab] = useState<'cli' | 'agent' | 'vscode'>(
    'agent'
  );
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    initial: { opacity: 1 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    initial: { y: 20, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="max-w-5xl mx-auto text-center relative"
    >
      {/* Badge */}
      <motion.div
        variants={itemVariants}
        className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 text-sm font-medium rounded-full border border-blue-200 shadow-lg"
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <Rocket className="w-4 h-4" />
        </motion.div>
        <span>Open Source & Free Forever</span>
      </motion.div>

      {/* Main heading */}
      <motion.h1
        variants={itemVariants}
        className="text-5xl md:text-7xl font-black text-slate-900 mb-6 leading-tight"
      >
        Make Your Codebase <br />
        <motion.span
          key={currentWord}
          initial={{ opacity: 0, y: 20, rotateX: -90 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, y: -20, rotateX: 90 }}
          transition={{ duration: 0.5 }}
          className="inline-block bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 bg-clip-text text-transparent"
        >
          {words[currentWord]}
        </motion.span>
      </motion.h1>

      {/* Description */}
      <motion.p
        variants={itemVariants}
        className="text-xl md:text-2xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed"
      >
        <span className="font-semibold text-slate-900">
          Your AI tools aren't broken. Your codebase confuses them.
        </span>
        <br />
        See why Coding Agents struggle and where small changes unlock outsized
        AI leverage—in 5 minutes.
        <br />
        <span className="text-blue-600 font-medium whitespace-normal">
          Optimized for frontier models: GPT-5, Claude 4.6, & Gemini 3.1 Pro.
        </span>
      </motion.p>

      {/* RESTORED AND MOVED CTA SECTION (Formerly at bottom of CTA.tsx) */}
      <motion.div
        variants={itemVariants}
        className="max-w-4xl mx-auto relative mb-20"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 rounded-3xl blur-2xl opacity-10 animate-pulse" />

        <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 rounded-3xl p-1 shadow-2xl">
          <div className="bg-slate-900 rounded-[22px] p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
              See Why AI Struggles with Your Code
            </h2>

            {/* Toggle buttons */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <button
                onClick={() => setActiveTab('cli')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                  activeTab === 'cli'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Terminal className="w-4 h-4" />
                CLI Command
              </button>
              <button
                onClick={() => setActiveTab('agent')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                  activeTab === 'agent'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Bot className="w-4 h-4" />
                AI Agent Prompt
              </button>
              <a
                href="https://marketplace.visualstudio.com/items?itemName=pengcao.aiready"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 flex items-center gap-2"
              >
                <Code2 className="w-4 h-4" />
                VS Code Extension
              </a>
            </div>

            {/* CLI Command */}
            {activeTab === 'cli' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800 rounded-2xl p-6 text-left mb-8 border border-slate-700 max-w-2xl mx-auto"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <button
                    onClick={() => copyToClipboard('npx @aiready/cli scan')}
                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <code className="text-green-400 font-mono text-lg break-all">
                  npx @aiready/cli scan
                </code>
              </motion.div>
            )}

            {/* Agent Prompt */}
            {activeTab === 'agent' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 max-w-2xl mx-auto"
              >
                <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                  <AgentPrompt variant="basic" />
                </div>
              </motion.div>
            )}

            {activeTab === 'vscode' && null /* Handled by link */}

            <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-slate-400 mb-8">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Free forever
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Open source
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> No credit
                card
              </span>
            </div>

            {/* Compatible with Section */}
            <div className="pt-8 border-t border-slate-800">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-6">
                Compatible with
              </p>
              <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-400" /> Cline
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-400" /> Claude Code
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-cyan-400" /> Cursor
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-orange-400" /> Copilot
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Audit link below the card */}
        <div className="mt-8">
          <p className="text-slate-500 text-sm">
            Need help?{' '}
            <a
              href="#audit-form"
              className="text-blue-500 font-semibold hover:text-blue-400 underline underline-offset-4 decoration-blue-500/30 hover:decoration-blue-500 transition-all"
            >
              Request a personalized audit or consulting session
            </a>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
