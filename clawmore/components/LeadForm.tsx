'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';

interface LeadFormProps {
  type: 'beta' | 'waitlist';
  onSuccess?: () => void;
}

export default function LeadForm({ type, onSuccess }: LeadFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isBeta = type === 'beta';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_LEAD_API_URL;
      if (!apiUrl) throw new Error('API URL not configured');

      const response = await fetch(`${apiUrl}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          repoUrl,
          interest: type.toUpperCase(),
          notes,
        }),
      });

      if (!response.ok) {
        throw new Error('Submission failed. Please try again.');
      }

      setStatus('success');
      if (onSuccess) {
        setTimeout(onSuccess, 3000);
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Something went wrong');
    }
  };

  if (status === 'success') {
    return (
      <div className="p-8 text-center py-16">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 bg-cyber-green/20 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 className="w-10 h-10 text-cyber-green" />
        </motion.div>
        <h3 className="text-2xl font-bold text-white mb-2">
          You're on the list!
        </h3>
        <p className="text-white/60">
          {isBeta
            ? "Thank you for applying for managed beta. We'll be in touch shortly."
            : "You've successfully joined the waitlist. We'll update you on our progress."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h3 className="text-2xl font-black tracking-tight text-white mb-2">
          {isBeta ? 'Request Managed Beta' : 'Join the Waitlist'}
        </h3>
        <p className="text-white/50 text-sm">
          {isBeta
            ? 'Get prioritized access to our fully managed autonomous infrastructure service.'
            : 'Be the first to know when we open up new slots for our self-evolving infrastructure engine.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5 ml-1">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-cyber-blue/50 transition-colors"
          />
        </div>

        {isBeta && (
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5 ml-1">
              GitHub Repository URL
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-cyber-blue/50 transition-colors"
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5 ml-1">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-cyber-blue/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5 ml-1">
            Notes / Use Case (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tell us about your infrastructure..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-cyber-blue/50 transition-colors h-24 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            isBeta
              ? 'bg-cyber-blue hover:bg-cyber-blue/90 text-black shadow-[0_0_20px_rgba(0,224,255,0.3)]'
              : 'bg-white/10 hover:bg-white/20 text-white'
          } disabled:opacity-50`}
        >
          {status === 'loading' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {isBeta ? 'Request Priority Access' : 'Join Waitlist'}
              <Send className="w-4 h-4" />
            </>
          )}
        </button>

        {status === 'error' && (
          <p className="text-red-400 text-xs text-center">{errorMessage}</p>
        )}
      </form>
    </div>
  );
}
