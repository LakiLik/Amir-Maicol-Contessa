import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { Users, Plus, Trash2, Mail, Shield } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from '../lib/db-mock';
import { db } from '../lib/db-mock';

interface Collaborator {
  id: string;
  email: string;
  role: 'Collaboratore' | 'Veterinario';
  ownerId: string;
  createdAt: number;
}

interface CollaboratorsProps {
  user: User;
}

export default function Collaborators({ user }: CollaboratorsProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchCollaborators();
  }, [user.id]);

  const fetchCollaborators = async () => {
    try {
      const q = query(collection(db, 'collaborators'), where('ownerId', '==', user.id));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Collaborator));
      setCollaborators(data.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error('Error fetching collaborators', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const role = formData.get('role') as 'Collaboratore' | 'Veterinario';

    if (!email) return;

    try {
      const newCollab = {
        email,
        role,
        ownerId: user.id,
        createdAt: Date.now()
      };
      await addDoc(collection(db, 'collaborators'), newCollab);
      setIsModalOpen(false);
      fetchCollaborators();
    } catch (error) {
      console.error('Error adding collaborator', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler rimuovere questo collaboratore?')) {
      try {
        await deleteDoc(doc(db, 'collaborators', id));
        fetchCollaborators();
      } catch (error) {
        console.error('Error deleting collaborator', error);
      }
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-[var(--fg-color)] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase mb-1 flex items-center gap-2">
            <Users className="w-8 h-8" />
            Collaboratori
          </h1>
          <p className="font-serif italic text-sm uppercase opacity-60">Gestione accessi e condivisione</p>
        </div>
        <button type="button" onClick={() => setIsModalOpen(true)} className="flex items-center text-xs border border-[var(--fg-color)] bg-[var(--fg-color)] text-[var(--bg-color)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--card-bg)] hover:text-[var(--fg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer">
          <Plus size={14} className="mr-2" /> Aggiungi
        </button>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[4px_4px_0px_0px_var(--fg-color)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center font-mono text-xs animate-pulse opacity-50 uppercase tracking-widest">Caricamento collaboratori...</div>
        ) : collaborators.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
             <Users className="w-12 h-12 opacity-20 mb-4" />
             <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Nessun collaboratore aggiunto. Clicca su "Aggiungi" per iniziare a condividere i tuoi dati.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--fg-color)]">
            {collaborators.map(c => (
              <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-[var(--bg-color)] transition-colors gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--fg-color)] text-[var(--bg-color)] flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{c.email}</h3>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest opacity-60 font-mono mt-1">
                      <Shield size={10} /> {c.role}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="text-[9px] font-mono uppercase tracking-widest opacity-40 hidden sm:block mr-4">
                      Aggiunto: {new Date(c.createdAt).toLocaleDateString()}
                   </div>
                   <button onClick={() => handleDelete(c.id)} className="p-2 border border-[var(--fg-color)] text-red-600 bg-[var(--card-bg)] hover:bg-red-50 hover:text-red-700 transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                     <Trash2 size={14} />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[var(--bg-color)]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border-2 border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] w-full max-w-md">
            <div className="p-6 border-b border-[var(--fg-color)] flex justify-between items-center bg-[var(--fg-color)] text-[var(--bg-color)]">
              <h2 className="text-xl font-bold tracking-tighter uppercase">Nuovo Collaboratore</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="hover:opacity-70 transition-opacity">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Email Collaboratore</label>
                <input type="email" name="email" required placeholder="collaboratore@email.com" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono" />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Ruolo</label>
                <select name="role" required className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                  <option value="Collaboratore">Collaboratore</option>
                  <option value="Veterinario">Veterinario</option>
                </select>
                <p className="text-[9px] font-serif italic mt-2 opacity-60">
                   Per ora "Collaboratore" e "Veterinario" hanno gli stessi accessi. Verranno distinti con i prossimi aggiornamenti.
                </p>
              </div>

              <div className="pt-4 flex gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 text-xs border border-[var(--fg-color)] bg-[var(--card-bg)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer">
                  Annulla
                </button>
                <button type="submit" className="flex-1 text-xs border border-[var(--fg-color)] bg-[var(--fg-color)] text-[var(--bg-color)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--bg-color)] hover:text-[var(--fg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer">
                  Aggiungi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
