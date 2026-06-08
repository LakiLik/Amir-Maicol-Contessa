import { supabase } from '../lib/supabase';
import React, { useState } from 'react';
import { LogIn } from 'lucide-react';

export default function Auth() {
  const [errorMsg, setErrorMsg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMsg('');
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setErrorMsg('Registrato. Controlla email o accedi.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || 'Errore sconosciuto');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-color)] text-[var(--fg-color)] font-sans border-[12px] border-[var(--fg-color)]">
      <div className="max-w-md w-full bg-[var(--card-bg)] border-2 border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] p-8 space-y-8">
        <div className="text-center">
          <div className="flex flex-col items-center justify-center mx-auto mb-4">
            <img src="/logo.png" alt="" className="w-16 h-16 rounded-xl mb-2 object-contain dark:invert" onError={(e) => e.currentTarget.style.display = 'none'} />
            <div className="flex flex-col items-center">
              <h1 className="text-4xl font-bold tracking-tighter uppercase leading-none text-center">MOOSH<span className="font-light opacity-60 lowercase">ion</span></h1>
              <p className="mt-0 text-[10px] font-bold font-mono uppercase tracking-widest opacity-60 text-center">Beyond the farm</p>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold font-mono uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[var(--bg-color)] border-2 border-[var(--fg-color)] p-3 outline-none focus:bg-[var(--card-bg)] transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold font-mono uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--bg-color)] border-2 border-[var(--fg-color)] p-3 outline-none focus:bg-[var(--card-bg)] transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-2 bg-[var(--fg-color)] hover:bg-[var(--card-bg)] hover:text-[var(--fg-color)] hover:border-[var(--fg-color)] text-[var(--bg-color)] border-2 border-transparent p-4 font-bold uppercase tracking-widest text-xs transition-colors outline-none shadow-[4px_4px_0px_0px_var(--fg-color)]"
          >
            <LogIn size={20} />
            <span>{isSignUp ? 'Registrati' : 'Accedi'}</span>
          </button>
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs font-bold font-mono uppercase tracking-widest hover:underline"
            >
              {isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
            </button>
          </div>
        </form>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-100 border-2 border-red-500 text-red-700 text-xs font-mono break-words">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
