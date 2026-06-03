import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogIn } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Auth() {
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      console.error(error);
      setErrorMsg(error?.message || 'Errore durante il redirect');
    });
  }, []);

  const signInWithGoogle = async () => {
    try {
      setErrorMsg('');
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || 'Errore sconosciuto');
    }
  };

  const signInWithGooglePopup = async () => {
    try {
      setErrorMsg('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
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
        
        <div className="space-y-4">
          <button
            onClick={signInWithGooglePopup}
            className="w-full flex items-center justify-center space-x-2 bg-[#141414] hover:bg-white hover:text-[#141414] hover:border-[#141414] text-[#E4E3E0] border-2 border-transparent p-4 font-bold uppercase tracking-widest text-xs transition-colors outline-none shadow-[4px_4px_0px_0px_#141414]"
          >
            <LogIn size={20} />
            <span>Accedi con Google (Popup)</span>
          </button>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-gray-100 text-[#141414] border-2 border-[#141414] p-4 font-bold uppercase tracking-widest text-xs transition-colors outline-none shadow-[4px_4px_0px_0px_#141414]"
          >
            <LogIn size={20} />
            <span>Accedi con Google (Redirect)</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-100 border-2 border-red-500 text-red-700 text-xs font-mono break-words">
            <p className="font-bold uppercase tracking-wider mb-1">Errore Autenticazione</p>
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
