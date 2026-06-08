/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AnimalGrid from './components/AnimalGrid';
import AnimalDetail from './components/AnimalDetail';
import FeedManagement from './components/FeedManagement';
import MilkTracking from './components/MilkTracking';
import AlertsList from './components/AlertsList';
import DatabaseExplorer from './components/DatabaseExplorer';
import MapArea from './components/MapArea';
import Collaborators from './components/Collaborators';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(err => {
      console.error("Errore di sessione auth:", err);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-color)] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--fg-color)]"></div>
        <div className="text-xs font-mono uppercase tracking-widest opacity-50">Connessione al database in corso...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
      <HashRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Layout user={user} />}>
              <Route index element={<Dashboard user={user} />} />
              <Route path="grid" element={<AnimalGrid user={user} />} />
              <Route path="animal/:id" element={<AnimalDetail user={user} />} />
              <Route path="feed" element={<FeedManagement user={user} />} />
              <Route path="milk" element={<MilkTracking user={user} />} />
              <Route path="map" element={<MapArea user={user} />} />
              <Route path="alerts" element={<AlertsList user={user} />} />
              <Route path="database" element={<DatabaseExplorer user={user} />} />
              <Route path="collaborators" element={<Collaborators user={user} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </HashRouter>
  );
}


