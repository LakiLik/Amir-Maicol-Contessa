/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <HashRouter>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

