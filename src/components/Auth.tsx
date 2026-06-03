import { supabase } from '../lib/supabase';
import { LogIn } from 'lucide-react';
import { useState } from 'react';

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setErrorMsg('Registrazione completata! Puoi accedere subito (se hai disabilitato la "Confirm email" nella console Supabase -> Authentication -> Providers -> Email). Altrimenti controlla la tua email.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || 'Errore sconosciuto');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#E4E3E0] text-[#141414] font-sans border-[12px] border-[#141414]">
      <div className="max-w-md w-full bg-white border-2 border-[#141414] shadow-[8px_8px_0px_0px_#141414] p-8 space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center mx-auto mb-6">
            <h1 className="text-4xl font-bold tracking-tighter uppercase">AgroSync <span className="font-normal italic font-serif opacity-70">Pro</span></h1>
          </div>
          <p className="mt-2 text-xs font-bold font-mono uppercase tracking-widest opacity-60">Autenticazione Operatore</p>
        </div>
        
        {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) ? (
          <div className="p-4 bg-yellow-100 border-2 border-yellow-500 text-yellow-800 text-xs font-mono">
             Devi configurare <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong> nel tuo file .env per usare l'autenticazione.
          </div>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold font-mono uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#E4E3E0] border-2 border-[#141414] p-3 outline-none focus:bg-white transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold font-mono uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#E4E3E0] border-2 border-[#141414] p-3 outline-none focus:bg-white transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 bg-[#141414] hover:bg-white hover:text-[#141414] hover:border-[#141414] text-[#E4E3E0] border-2 border-transparent p-4 font-bold uppercase tracking-widest text-xs transition-colors outline-none shadow-[4px_4px_0px_0px_#141414]"
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
        )}

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-100 border-2 border-red-500 text-red-700 text-xs font-mono break-words">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
