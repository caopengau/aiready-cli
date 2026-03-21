'use client';

import React from 'react';
import { ManagedAccountStatus } from '../../components/ManagedAccountStatus';
import Navbar from '../../components/Navbar';
import {
  Activity,
  LayoutDashboard,
  Settings,
  User,
  Zap,
  Terminal,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardClientProps {
  user: any;
  isAdmin?: boolean;
  status: {
    awsSpendCents: number;
    awsInclusionCents: number;
    aiTokenBalanceCents: number;
    aiRefillThresholdCents: number;
    mutationCount: number;
  };
}

export default function DashboardClient({
  user,
  isAdmin,
  status,
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = React.useState('overview');
  const [isByokEnabled, setIsByokEnabled] = React.useState(false);
  const [apiKey, setApiKey] = React.useState('');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-cyber-blue/30 selection:text-cyber-blue font-sans">
      <Navbar />

      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter italic">
              Managed <span className="text-cyber-blue">Platform</span>
            </h1>
            <p className="text-zinc-500 mt-1 font-mono text-xs uppercase tracking-widest">
              Live Infrastructure Evolution Status
            </p>
          </div>

          <div className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 p-3 rounded-2xl backdrop-blur-md">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyber-blue to-purple-600 flex items-center justify-center font-bold">
              {user.name?.[0] || user.email?.[0] || 'U'}
            </div>
            <div>
              <p className="text-sm font-bold">{user.name || 'Developer'}</p>
              <p className="text-[10px] text-zinc-500 font-mono">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-2">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-white border border-transparent group'
                }`}
              >
                <LayoutDashboard
                  className={`w-4 h-4 ${activeTab === 'overview' ? '' : 'group-hover:text-cyber-blue transition-colors'}`}
                />
                Overview
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:bg-white/5 hover:text-white rounded-xl text-sm font-medium transition-all group">
                <Activity className="w-4 h-4 group-hover:text-cyber-blue transition-colors" />
                Nodes
              </button>

              <Link
                href="/dashboard/clawcenter"
                className="w-full flex items-center justify-between px-4 py-3 text-emerald-500 hover:bg-emerald-500/10 rounded-xl text-sm font-bold transition-all group border border-transparent hover:border-emerald-500/20"
              >
                <div className="flex items-center gap-3">
                  <Terminal className="w-4 h-4" />
                  <span>ClawCenter</span>
                </div>
                <Zap className="w-3 h-3 animate-pulse" />
              </Link>

              <button className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:bg-white/5 hover:text-white rounded-xl text-sm font-medium transition-all group">
                <User className="w-4 h-4 group-hover:text-cyber-blue transition-colors" />
                Account
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'settings'
                    ? 'bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-white border border-transparent group'
                }`}
              >
                <Settings
                  className={`w-4 h-4 ${activeTab === 'settings' ? '' : 'group-hover:text-cyber-blue transition-colors'}`}
                />
                Settings
              </button>

              {isAdmin && (
                <div className="pt-4 mt-4 border-t border-white/5">
                  <p className="px-4 text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">
                    Management
                  </p>
                  <Link
                    href="/admin/leads"
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-bold transition-all group border border-transparent hover:border-red-500/20"
                  >
                    <Shield className="w-4 h-4" />
                    Admin Panel
                  </Link>
                </div>
              )}
            </nav>
          </div>

          {/* Main Dashboard Content */}
          <div className="lg:col-span-3 space-y-8">
            {activeTab === 'overview' ? (
              <>
                <ManagedAccountStatus
                  awsSpendCents={status.awsSpendCents}
                  awsInclusionCents={status.awsInclusionCents}
                  aiTokenBalanceCents={status.aiTokenBalanceCents}
                  aiRefillThresholdCents={status.aiRefillThresholdCents}
                  mutationCount={status.mutationCount}
                />

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyber-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyber-blue" />
                    Recent Activity
                  </h2>

                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-cyber-blue/20 transition-all"
                      >
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="flex-grow">
                          <p className="text-sm font-medium text-white">
                            Infrastructure Mutation v0.4.{i + 8}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono italic">
                            Successful Commit • 2h ago
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-emerald-500">
                            +1 SCR
                          </p>
                          <p className="text-[10px] text-zinc-600 font-mono tracking-tighter">
                            ID: claw_{Math.random().toString(36).substring(7)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : activeTab === 'settings' ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
                <h2 className="text-xl font-bold mb-6">Platform Settings</h2>

                <div className="space-y-8">
                  <div className="pb-8 border-b border-white/10">
                    <h3 className="text-lg font-medium text-white mb-2">
                      Subscription
                    </h3>
                    <p className="text-sm text-zinc-400 mb-4">
                      You are on the $29/mo Managed Platform tier. This includes
                      full managed infrastructure, zero-idle guarantees, and $10
                      in AI mutation fuel per month.
                    </p>
                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-colors border border-white/10">
                      Manage Billing
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-amber-500 mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Advanced: Bring Your Own Key
                      (BYOK)
                    </h3>
                    <p className="text-sm text-zinc-400 mb-6">
                      By default, ClawMore fully manages your AI infrastructure
                      and token limits. For enterprise customers or users with
                      startup credits, you can bypass our token pool and use
                      your own OpenAI or Anthropic API key. By enabling this,
                      your $1.00 Mutation Tax is waived.
                    </p>

                    <div className="bg-black/50 p-6 rounded-2xl border border-white/5 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">
                            Enable BYOK Mode
                          </p>
                          <p className="text-xs text-zinc-500">
                            Route all agent requests through your own API keys
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isByokEnabled}
                            onChange={() => setIsByokEnabled(!isByokEnabled)}
                          />
                          <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {isByokEnabled && (
                        <div className="pt-6 border-t border-white/10 space-y-4">
                          <div>
                            <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                              OpenRouter API Key
                            </label>
                            <input
                              type="password"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="sk-or-v1-..."
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500 transition-colors font-mono text-sm"
                            />
                          </div>
                          <button className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-lg text-sm transition-colors w-full font-bold">
                            Save Configuration
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
