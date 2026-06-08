import { useState, useEffect, FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from '../lib/db-mock';
import { db } from '../lib/db-mock';
import { CustomAlert } from '../types';
import { Plus, Bell, Calendar, Check, X, BellRing, AlertCircle, Trash2 } from 'lucide-react';

export default function AlertsList({ user }: { user: User }) {
  const [alerts, setAlerts] = useState<CustomAlert[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'alerts'), where('userId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomAlert)).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setAlerts(data);
    });
    return unsubscribe;
  }, [user.id]);

  const handleCreateAlert = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await addDoc(collection(db, 'alerts'), {
      title: fd.get('title'),
      message: fd.get('message'),
      date: fd.get('date'),
      type: fd.get('type'),
      animalId: fd.get('animalId') || '',
      isRead: false,
      userId: user.id,
      createdAt: Date.now()
    });
    setIsModalOpen(false);
  };

  const toggleRead = async (alert: CustomAlert) => {
    await updateDoc(doc(db, 'alerts', alert.id), {
      isRead: !alert.isRead
    });
  };

  const deleteAlert = async (id: string) => {
    await deleteDoc(doc(db, 'alerts', id));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vaccine': return <AlertCircle size={20} />;
      case 'birth': return <Calendar size={20} />;
      case 'estrus': return <BellRing size={20} />;
      default: return <Bell size={20} />;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase mb-2">Centro Avvisi</h1>
          <p className="font-serif italic text-sm uppercase opacity-60">Scadenze, nascite & eventi</p>
        </div>
        <button type="button" onClick={() => setIsModalOpen(true)} className="flex items-center text-xs border border-[var(--fg-color)] bg-[var(--fg-color)] text-[var(--bg-color)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--card-bg)] hover:text-[var(--fg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer">
          <Plus size={14} className="mr-2" /> Nuovo Avviso
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {alerts.length === 0 ? (
           <div className="col-span-full py-20 text-center text-xs font-mono uppercase opacity-50 border border-[var(--fg-color)] border-dashed">
            Nessun avviso in programma.
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className={`border border-[var(--fg-color)] p-5 shadow-[4px_4px_0px_0px_var(--fg-color)] transition-all group relative overflow-hidden ${alert.isRead ? 'bg-[var(--bg-color)] opacity-70' : 'bg-[var(--card-bg)]'}`}>
              {!alert.isRead && (
                 <div className="absolute top-0 right-0 w-8 h-8 bg-black">
                    <div className="w-full h-full border-t-[32px] border-l-[32px] border-t-[var(--fg-color)] border-l-transparent"></div>
                 </div>
              )}
              <div className="flex items-start justify-between mb-4">
                 <div className={`p-2 border border-[var(--fg-color)] ${alert.isRead ? 'bg-transparent text-[var(--fg-color)]' : 'bg-[var(--fg-color)] text-[var(--bg-color)]'}`}>
                   {getTypeIcon(alert.type)}
                 </div>
                 <div className="flex flex-col items-end gap-2">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest border border-[var(--fg-color)] px-1.5 py-0.5 bg-[var(--card-bg)] text-[var(--fg-color)]">
                      {alert.date}
                    </div>
                  </div>
              </div>
              <h3 className={`text-lg font-bold uppercase tracking-tight mb-2 ${alert.isRead ? 'line-through' : ''}`}>{alert.title}</h3>
              <p className="font-serif italic text-sm mb-6 line-clamp-3">{alert.message}</p>
              {alert.animalId && (
                <p className="text-[10px] font-mono uppercase tracking-widest mb-4">Ref: {alert.animalId}</p>
              )}
              <div className="flex gap-2 mt-auto border-t border-[var(--fg-color)] pt-4">
                 <button onClick={() => toggleRead(alert)} className={`flex-1 flex justify-center items-center py-2 px-2 border border-[var(--fg-color)] text-[9px] font-bold uppercase tracking-widest transition-colors ${alert.isRead ? 'bg-[var(--card-bg)] text-[var(--fg-color)] hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)]' : 'bg-[var(--fg-color)] text-[var(--bg-color)] hover:bg-[var(--card-bg)] hover:text-[var(--fg-color)]'}`}>
                    <Check size={12} className="mr-1" /> {alert.isRead ? 'Segna da Leggere' : 'Segna Letto'}
                 </button>
                 <button onClick={() => deleteAlert(alert.id)} className="flex items-center justify-center py-2 px-3 border border-[var(--fg-color)] bg-[var(--card-bg)] text-red-600 hover:bg-red-600 hover:text-white transition-colors">
                    <Trash2 size={12} />
                 </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
               <form onSubmit={handleCreateAlert}>
                  <div className="p-8">
                     <div className="flex justify-between items-start border-b border-[var(--fg-color)] pb-4 mb-6">
                      <div>
                        <h3 className="text-2xl font-bold tracking-tighter uppercase mb-1">Crea Avviso</h3>
                        <p className="font-serif italic text-[11px] uppercase opacity-60">Pianifica un evento personalizzato</p>
                      </div>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="text-[var(--fg-color)] hover:opacity-50"><X size={24} /></button>
                    </div>

                    <div className="space-y-4">
                       <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Tipo Evento *</label>
                          <select required name="type" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 font-mono text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]">
                             <option value="vaccine">Vaccinazione</option>
                             <option value="birth">Parto Previsto</option>
                             <option value="estrus">Ciclo Estrale</option>
                             <option value="other">Altro</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Titolo *</label>
                          <input required type="text" name="title" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm font-bold uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data Scadenza *</label>
                          <input required type="date" name="date" className="block w-full border border-[var(--fg-color)] bg-[var(--bg-color)] py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Riferimento Orecchino/Gruppo (Opz.)</label>
                          <input type="text" name="animalId" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Testo Avviso *</label>
                          <textarea required name="message" rows={3} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 font-serif text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]"></textarea>
                       </div>
                    </div>
                  </div>
                  <div className="bg-[var(--bg-color)] px-8 py-4 border-t border-[var(--fg-color)]">
                    <button type="submit" className="w-full justify-center border border-transparent bg-[var(--fg-color)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--card-bg)] hover:border-[var(--fg-color)] hover:text-[var(--fg-color)] transition-colors active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                      Salva e Attiva
                    </button>
                  </div>
               </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
