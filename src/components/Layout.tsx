import { Outlet, NavLink } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, TableProperties, LogOut, Menu, X, Wheat, Droplet, Bell, Database, Map, Users, RefreshCw, Moon, Circle } from 'lucide-react';
import { useState, useEffect } from 'react';
import logoUrl from '../assets/logo.png';
// import { collection, query, where, onSnapshot } from '../lib/db-mock';
// import { db } from '../lib/db-mock';
import { CustomAlert } from '../types';

interface LayoutProps {
  user: User;
}

export default function Layout({ user }: LayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

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

  // useEffect(() => {
  //   const q = query(collection(db, 'alerts'), where('userId', '==', user.id), where('isRead', '==', false));
  //   const unsubscribe = onSnapshot(q, (snapshot) => {
  //     setUnreadAlerts(snapshot.docs.length);
  //   });
  //   return unsubscribe;
  // }, [user.id]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Archivio Capi', href: '/grid', icon: TableProperties },
    { name: 'Produzione Latte', href: '/milk', icon: Droplet },
    { name: 'Mappa Pascoli', href: '/map', icon: Map },
    { name: 'Magazzino Alimentare', href: '/feed', icon: Wheat },
    { name: 'Avvisi e Scadenze', href: '/alerts', icon: Bell, count: unreadAlerts },
    { name: 'Collaboratori', href: '/collaborators', icon: Users },
    { name: 'Database Raw (Admin)', href: '/database', icon: Database },
  ];

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--bg-color)] text-[var(--fg-color)] font-sans border-0 md:border-[12px] border-[var(--fg-color)]">
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-0 w-full z-50 bg-[var(--bg-color)] border-b border-[var(--fg-color)] px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <img src={logoUrl} alt="" className="w-6 h-6 rounded-md mr-2 object-contain dark:invert" onError={(e) => e.currentTarget.style.display = 'none'} />
          <div className="flex flex-col items-start mt-1">
            <span className="text-xl font-bold tracking-tighter uppercase leading-none">MOOSH<span className="font-light opacity-60 lowercase">ion</span></span>
            <span className="text-[7px] font-bold font-mono uppercase tracking-widest opacity-60 mt-[2px]">Beyond the farm</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={toggleTheme} className="p-2 border border-[var(--fg-color)] bg-[var(--card-bg)] shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer" title="Cambia Tema">
             {isDark ? <Moon size={16} /> : <Circle size={16} fill="currentColor" />}
           </button>
           <button onClick={() => window.location.reload()} className="p-2 border border-[var(--fg-color)] bg-[var(--card-bg)] shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer" title="Aggiorna dati">
             <RefreshCw size={16} />
           </button>
           <button
             onClick={() => setIsMobileOpen(!isMobileOpen)}
             className="p-2 text-[var(--fg-color)] opacity-70 border border-transparent hover:border-[var(--fg-color)]"
           >
             {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
           </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[var(--bg-color)] border-r border-[var(--fg-color)] p-6
        transform transition-transform duration-200 ease-in-out md:translate-x-0 md:relative md:w-64 flex flex-col space-y-8
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="md:hidden flex flex-col mb-2 mt-12 md:mt-0">
          {/* Mobile menu padding equivalent */}
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
                  ? 'underline decoration-2 underline-offset-4 text-[var(--fg-color)]' 
                  : 'opacity-40 hover:opacity-100 text-[var(--fg-color)]'
                }
              `}
            >
              <item.icon
                className="flex-shrink-0 mr-3 h-4 w-4"
                aria-hidden="true"
              />
              <span className="flex-1">{item.name}</span>
              {item.count ? (
                <span className="ml-auto inline-block py-0.5 px-2 bg-[var(--fg-color)] text-[var(--bg-color)] text-[9px] rounded-sm">
                  {item.count}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--fg-color)] pt-4 space-y-4">
          <p className="font-serif italic text-[11px] uppercase opacity-50 block mb-2">Operatore</p>
          <div className="flex items-center space-x-3 bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[4px_4px_0px_0px_var(--fg-color)] p-3">
            <div className="w-8 h-8 bg-[var(--fg-color)] text-[var(--bg-color)] flex items-center justify-center font-bold text-xs">
              {user.email?.[0].toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold font-mono tracking-tighter uppercase truncate text-[var(--fg-color)]">{user.email?.split('@')[0]}</p>
              <p className="text-[9px] font-mono opacity-50 truncate">{user.email}</p>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-1 border border-[var(--fg-color)] hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors"
              title="Esci"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col pt-16 md:pt-0">
        {/* Top Status Bar desktop */}
        <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-[var(--fg-color)]">
           <div className="flex items-center">
             <img src={logoUrl} alt="" className="w-8 h-8 rounded-lg mr-2 object-contain dark:invert" onError={(e) => e.currentTarget.style.display = 'none'} />
             <div className="flex flex-col items-start mt-1">
               <span className="text-xl font-bold tracking-tighter uppercase leading-none">MOOSH<span className="font-light opacity-60 lowercase">ion</span></span>
               <span className="text-[8px] font-bold font-mono uppercase tracking-widest opacity-60 mt-[2px]">Beyond the farm</span>
             </div>
           </div>
           
           <div className="flex items-center justify-end">
             <button onClick={toggleTheme} className="flex items-center justify-center p-2 mr-4 border border-[var(--fg-color)] bg-[var(--card-bg)] font-mono text-[10px] uppercase font-bold tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] transition-colors active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer" title="Cambia Tema">
               {isDark ? <Moon size={16} /> : <Circle size={16} fill="currentColor" />}
             </button>
             <button type="button" onClick={() => window.location.reload()} title="Aggiorna Dati" className="flex items-center justify-center p-2 mr-4 border border-[var(--fg-color)] bg-[var(--card-bg)] font-mono text-[10px] uppercase font-bold tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] transition-colors active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer">
                <RefreshCw size={16} />
             </button>
             <div className={`flex items-center px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-widest border border-[var(--fg-color)] mr-4 transition-colors ${isOnline ? 'bg-[var(--card-bg)] text-[var(--fg-color)]' : 'bg-red-100 text-red-900 border-red-900'}`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
                {isOnline && <span className="border-l border-[var(--fg-color)]/30 ml-2 pl-2 opacity-70">SYNC: {lastSync}</span>}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest font-bold">
                 {new Date().toLocaleDateString()}
              </div>
           </div>
        </header>

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
