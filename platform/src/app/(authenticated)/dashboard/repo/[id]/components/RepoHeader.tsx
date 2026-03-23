'use client';

import Link from 'next/link';
import { FileIcon, InfoIcon, PlayIcon, SettingsIcon } from '@/components/Icons';
import {
  scoreColor,
  scoreBg,
  scoreGlow,
  scoreLabel,
} from '@aiready/components';
import type { Repository } from '@/lib/db';

interface RepoHeaderProps {
  repo: Repository;
  analysis: any;
  onViewConfig?: () => void;
}

export function RepoHeader({ repo, analysis, onViewConfig }: RepoHeaderProps) {
  return (
    <section className="w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-4">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-cyan-400 text-xs font-black uppercase tracking-widest hover:text-cyan-300 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-3 h-3 rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M13 5l7 7-7 7"
              />
            </svg>
            Back to Dashboard
          </Link>
          <Link
            href={`/dashboard/repo/${repo.id}/settings`}
            className="text-cyan-400 text-xs font-black uppercase tracking-widest hover:text-cyan-300 transition-colors flex items-center gap-2"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Scan Strategy
          </Link>
        </div>
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white leading-tight">
            {repo.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-slate-400 max-w-2xl">
              {repo.description ||
                'Comprehensive AI-readiness analysis for this repository.'}
            </p>
            {onViewConfig && (
              <button
                onClick={onViewConfig}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 rounded-xl border border-slate-700/50 transition-all text-[10px] font-bold uppercase tracking-widest"
              >
                <InfoIcon className="w-3 h-3" />
                View Scan Config
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <a
            href={repo.url}
            target="_blank"
            className="text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
          >
            <FileIcon className="w-3.5 h-3.5" />
            {repo.url}
          </a>
          {analysis && (
            <div className="text-slate-500 flex items-center gap-1.5">
              <PlayIcon className="w-3.5 h-3.5 rotate-90" />
              Last analyzed{' '}
              {new Date(analysis.metadata.timestamp).toLocaleString()}
              {analysis.summary.executionTime > 0 && (
                <span className="ml-2 pl-2 border-l border-slate-800">
                  Duration: {(analysis.summary.executionTime / 1000).toFixed(1)}
                  s
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {analysis && (
        <div
          className={`p-6 rounded-3xl border ${scoreBg(analysis.summary.aiReadinessScore)} ${scoreGlow(analysis.summary.aiReadinessScore)} shadow-2xl flex items-center gap-6`}
        >
          <div className="text-center">
            <div
              className={`text-5xl font-black ${scoreColor(analysis.summary.aiReadinessScore)}`}
            >
              {analysis.summary.aiReadinessScore}
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Score / 100
            </div>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div>
            <div className="text-lg font-bold text-white capitalize">
              {scoreLabel(analysis.summary.aiReadinessScore)}
            </div>
            <div className="text-xs text-slate-400">AI Readiness Maturity</div>
          </div>
        </div>
      )}
    </section>
  );
}
