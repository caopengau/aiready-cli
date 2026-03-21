'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      <div className="max-w-md w-full glass-card p-10 border-red-500/30 shadow-[0_0_100px_rgba(239,68,68,0.1)]">
        <div className="flex flex-col items-center mb-10">
          <Image
            src="/logo.png"
            alt="ClawMore Logo"
            width={64}
            height={64}
            className="mb-6 grayscale"
          />
          <h1 className="text-3xl font-black italic tracking-tighter text-white">
            Root Access
          </h1>
          <p className="text-red-500 text-sm mt-2 font-mono uppercase tracking-widest">
            {'>'} Super Admin Only
          </p>
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
              className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-red-500 transition-colors text-center tracking-[0.5em]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-sm bg-red-600 text-black font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-[0_0_30px_rgba(239,68,68,0.2)]"
          >
            {loading ? 'Verifying...' : 'Authenticate'}
          </button>
        </form>

        {error && (
          <p className="mt-6 text-red-400 text-xs text-center font-mono">
            [ERROR]: {error}
          </p>
        )}
      </div>
    </div>
  );
}
