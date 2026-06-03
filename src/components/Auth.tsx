import { signInWithRedirect, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogIn } from 'lucide-react';

export default function Auth() {
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error(error);
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
        
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center space-x-2 bg-[#141414] hover:bg-white hover:text-[#141414] hover:border-[#141414] text-[#E4E3E0] border-2 border-transparent p-4 font-bold uppercase tracking-widest text-xs transition-colors outline-none shadow-[4px_4px_0px_0px_#141414]"
        >
          <LogIn size={20} />
          <span>Accedi con Google</span>
        </button>
      </div>
    </div>
  );
}
