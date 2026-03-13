'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Layers,
  RefreshCcw,
  Zap,
  Activity,
  Code,
  ArrowLeft,
} from 'lucide-react';

interface NavbarProps {
  variant?: 'home' | 'post';
}

export default function Navbar({ variant = 'home' }: NavbarProps) {
  const pathname = usePathname();
  const isBlog = pathname?.startsWith('/blog');

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/5">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-4 group">
          <Image
            src="/logo.png"
            alt="ClawMore Logo"
            width={40}
            height={40}
            className={`transition-all ${
              variant === 'post' ? 'opacity-80 group-hover:opacity-100' : ''
            } ${!isBlog ? 'drop-shadow-[0_0_12px_rgba(0,224,255,0.8)]' : 'drop-shadow-[0_0_8px_rgba(0,224,255,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(0,224,255,0.6)]'}`}
          />
          <div className="flex flex-col">
            <span
              className={`text-xl font-bold tracking-tight leading-none group-hover:text-cyber-blue transition-colors ${!isBlog ? 'glow-text' : ''}`}
            >
              ClawMore
            </span>
            <span className="text-[8px] font-mono text-cyber-purple uppercase tracking-[0.2em] mt-0.5">
              Neural_Node_v1.0
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-6 lg:gap-10 text-[11px] font-mono uppercase tracking-widest text-zinc-500">
          {variant === 'home' ? (
            <div className="hidden lg:flex items-center gap-10">
              <Link
                href="/#features"
                className="hover:text-cyber-blue hover:glow-blue transition-colors flex items-center gap-1.5"
              >
                <Layers className="w-3 h-3" /> Features
              </Link>
              <Link
                href="/#evolution"
                className="hover:text-cyber-blue hover:glow-blue transition-colors flex items-center gap-1.5"
              >
                <RefreshCcw className="w-3 h-3" /> Evolution
              </Link>
              <Link
                href="/#pricing"
                className="hover:text-cyber-blue hover:glow-blue transition-colors flex items-center gap-1.5"
              >
                <Zap className="w-3 h-3" /> Pricing
              </Link>
              <Link
                href="/blog"
                className={`transition-colors flex items-center gap-1.5 ${
                  isBlog
                    ? 'text-cyber-purple glow-purple font-black'
                    : 'hover:text-cyber-purple hover:glow-purple'
                }`}
              >
                <Activity className="w-3 h-3" /> Blog
              </Link>
            </div>
          ) : (
            <Link
              href="/blog"
              className="hover:text-cyber-purple hover:glow-purple transition-colors flex items-center gap-2 text-zinc-300"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Journal
            </Link>
          )}

          <div className="flex items-center gap-4 pl-4 border-l border-white/10">
            <Link
              href="https://github.com/caopengau/serverlessclaw"
              className="hidden sm:flex px-4 py-2 rounded-sm bg-white/5 hover:bg-white/10 text-white transition-all items-center gap-2 border border-white/10"
            >
              <Code className="w-3 h-3" /> Source
            </Link>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-sm ${
                variant === 'home'
                  ? 'bg-cyber-blue/5 border border-cyber-blue/20'
                  : 'bg-cyber-purple/5 border border-cyber-purple/20'
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  variant === 'home' ? 'bg-cyber-blue' : 'bg-cyber-purple'
                }`}
              />
              <span
                className={`text-[9px] font-black ${
                  variant === 'home' ? 'text-cyber-blue' : 'text-cyber-purple'
                }`}
              >
                {variant === 'home' ? 'LINK_ACTIVE' : 'SYNC_ACTIVE'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
