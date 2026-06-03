import { Outlet, NavLink } from 'react-router-dom';
import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LayoutDashboard, TableProperties, LogOut, Menu, X, Wheat, Droplet, Bell, Database, Map } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CustomAlert } from '../types';

interface LayoutProps {
  user: User;
}

export default function Layout({ user }: LayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setLastSync(new Date().toLocaleTimeString()); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
       if (navigator.onLine) {
          setLastSync(new Date().toLocaleTimeString());
       }
    }, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'alerts'), where('userId', '==', user.uid), where('isRead', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadAlerts(snapshot.docs.length);
    });
    return unsubscribe;
  }, [user.uid]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Archivio Capi', href: '/grid', icon: TableProperties },
    { name: 'Produzione Latte', href: '/milk', icon: Droplet },
    { name: 'Mappa Pascoli', href: '/map', icon: Map },
    { name: 'Magazzino Alimentare', href: '/feed', icon: Wheat },
    { name: 'Avvisi e Scadenze', href: '/alerts', icon: Bell, count: unreadAlerts },
    { name: 'Database Raw (Admin)', href: '/database', icon: Database },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#E4E3E0] text-[#141414] font-sans border-0 md:border-[12px] border-[#141414]">
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-0 w-full z-50 bg-[#E4E3E0] border-b border-[#141414] px-4 h-16 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tighter uppercase">AgroSync <span className="font-normal italic font-serif opacity-70">Pro</span></span>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 -mr-2 text-[#141414] opacity-70 border border-transparent hover:border-[#141414]"
        >
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#E4E3E0] border-r border-[#141414] p-6
        transform transition-transform duration-200 ease-in-out md:translate-x-0 md:relative md:w-64 flex flex-col space-y-8
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-2 mt-12 md:mt-0">
          <h1 className="text-2xl font-bold tracking-tighter uppercase">AgroSync <span className="font-normal italic font-serif opacity-70">Pro</span></h1>
        </div>

        <nav className="flex-1 space-y-4">
          <p className="font-serif italic text-[11px] uppercase opacity-50 block mb-2">Navigazione</p>
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) => `
                group flex items-center text-xs font-bold uppercase tracking-widest transition-colors
                ${isActive 
                  ? 'underline decoration-2 underline-offset-4 text-[#141414]' 
                  : 'opacity-40 hover:opacity-100 text-[#141414]'
                }
              `}
            >
              <item.icon
                className="flex-shrink-0 mr-3 h-4 w-4"
                aria-hidden="true"
              />
              <span className="flex-1">{item.name}</span>
              {item.count ? (
                <span className="ml-auto inline-block py-0.5 px-2 bg-[#141414] text-[#E4E3E0] text-[9px] rounded-sm">
                  {item.count}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-[#141414] pt-4 space-y-4">
          <p className="font-serif italic text-[11px] uppercase opacity-50 block mb-2">Operatore</p>
          <div className="flex items-center space-x-3 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-8 h-8 border border-[#141414]" />
            ) : (
              <div className="w-8 h-8 bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-bold text-xs">
                {user.email?.[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold font-mono tracking-tighter uppercase truncate text-[#141414]">{user.displayName || user.email?.split('@')[0]}</p>
              <p className="text-[9px] font-mono opacity-50 truncate">{user.email}</p>
            </div>
            <button
              onClick={() => auth.signOut()}
              className="p-1 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
              title="Esci"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Top Status Bar desktop */}
        <header className="hidden md:flex items-center justify-end px-6 py-4 border-b border-[#141414]">
           <div className={`flex items-center px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-widest border border-[#141414] mr-4 transition-colors ${isOnline ? 'bg-white text-[#141414]' : 'bg-red-100 text-red-900 border-red-900'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
              {isOnline && <span className="border-l border-[#141414]/30 ml-2 pl-2 opacity-70">SYNC: {lastSync}</span>}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest font-bold">
               {new Date().toLocaleDateString()}
            </div>
        </header>

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
