'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEmailLoading(true);
    setError('');

    try {
      const res = await signIn('email', {
        email,
        callbackUrl: '/admin/leads',
        redirect: false,
      });

      if (res?.error) {
        setError('Failed to send magic link');
      } else {
        setEmailSent(true);
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid admin password');
      } else {
        router.push('/admin/leads');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-10 border-cyber-blue/30 shadow-[0_0_100px_rgba(0,224,255,0.1)]">
        <div className="flex flex-col items-center mb-10">
          <Image
            src="/logo.png"
            alt="ClawMore Logo"
            width={64}
            height={64}
            className="mb-6"
          />
          <h1 className="text-3xl font-black italic tracking-tighter text-white">
            Admin Access
          </h1>
          <p className="text-zinc-500 text-sm mt-2 font-mono uppercase tracking-widest">
            {'>'} Restricted Area
          </p>
        </div>

        {emailSent ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-cyber-blue/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-cyber-blue/30">
              <svg
                className="w-8 h-8 text-cyber-blue"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Check your email
            </h3>
            <p className="text-zinc-400 text-sm font-mono">
              Magic link sent to <br />
              <span className="text-cyber-blue">{email}</span>
            </p>
            <button
              onClick={() => setEmailSent(false)}
              className="mt-8 text-xs text-zinc-500 hover:text-white transition-colors font-mono uppercase tracking-widest"
            >
              Back to login
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleEmailSignIn} className="space-y-6 mb-8">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 mb-2 ml-1">
                  Admin Email (Magic Link)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-cyber-blue transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={emailLoading}
                className="w-full py-4 rounded-sm border border-cyber-blue/50 text-cyber-blue font-bold uppercase tracking-widest hover:bg-cyber-blue/10 transition-all shadow-[0_0_15px_rgba(0,224,255,0.1)]"
              >
                {emailLoading ? 'Sending...' : 'Send Magic Link (Beta)'}
              </button>
            </form>

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-[10px] font-mono uppercase tracking-widest">
                <span className="bg-[#0a0a0a] px-4 text-zinc-500">
                  OR USE PASSWORD
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 mb-2 ml-1">
                  Secret Key
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-cyber-blue transition-colors text-center tracking-[0.5em]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-sm bg-cyber-blue text-black font-black uppercase tracking-widest hover:bg-cyber-blue/90 transition-all shadow-[0_0_30px_rgba(0,224,255,0.2)]"
              >
                {loading ? 'Verifying...' : 'Authenticate'}
              </button>
            </form>
          </>
        )}

        {error && !emailSent && (
          <p className="mt-6 text-red-400 text-xs text-center font-mono">
            [ERROR]: {error}
          </p>
        )}

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-mono uppercase tracking-widest">
              <span className="bg-[#0a0a0a] px-4 text-zinc-500">
                Or Continue With
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => signIn('github', { redirectTo: '/admin/leads' })}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/5 text-white font-mono text-sm uppercase tracking-widest rounded-sm border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all cursor-pointer"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"
                />
              </svg>
              GitHub
            </button>

            <button
              type="button"
              onClick={() => signIn('google', { redirectTo: '/admin/leads' })}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/5 text-white font-mono text-sm uppercase tracking-widest rounded-sm border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
