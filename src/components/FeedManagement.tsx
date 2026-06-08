import { useState, useEffect, FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from '../lib/db-mock';
import { db } from '../lib/db-mock';
import { FeedStock, FeedTransaction } from '../types';
import { Plus, Minus, AlertTriangle, ArrowDown, ArrowUp, X } from 'lucide-react';

export default function FeedManagement({ user }: { user: User }) {
  const [stocks, setStocks] = useState<FeedStock[]>([]);
  const [transactions, setTransactions] = useState<FeedTransaction[]>([]);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [transType, setTransType] = useState<'purchase'|'consumption'>('purchase');
  const [selectedFeedId, setSelectedFeedId] = useState<string>('');

  useEffect(() => {
    const qStocks = query(collection(db, 'feedStocks'), where('userId', '==', user.id));
    const unsubStocks = onSnapshot(qStocks, (snap) => setStocks(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedStock))));

    const qTrans = query(collection(db, 'feedTransactions'), where('userId', '==', user.id));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedTransaction)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(data);
    });

    return () => { unsubStocks(); unsubTrans(); };
  }, [user.id]);

  const handleCreateStock = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await addDoc(collection(db, 'feedStocks'), {
      name: fd.get('name'),
      quantity: 0,
      threshold: Number(fd.get('threshold')),
      unit: fd.get('unit'),
      userId: user.id,
      createdAt: Date.now()
    });
    setIsStockModalOpen(false);
  };

  const handleTransaction = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount'));
    const feed = stocks.find(s => s.id === selectedFeedId);
    if (!feed) return;

    const newQuantity = transType === 'purchase' ? feed.quantity + amount : feed.quantity - amount;

    await addDoc(collection(db, 'feedTransactions'), {
      feedId: selectedFeedId,
      date: fd.get('date'),
      type: transType,
      amount: amount,
      notes: fd.get('notes') || '',
      userId: user.id,
      createdAt: Date.now()
    });

    await updateDoc(doc(db, 'feedStocks', selectedFeedId), {
      quantity: newQuantity
    });

    // Generate alert if went below threshold
    if (newQuantity < feed.threshold && feed.quantity >= feed.threshold) {
      await addDoc(collection(db, 'alerts'), {
        title: 'Giacenza in esaurimento!',
        message: `La disponibilità di ${feed.name} è scesa a ${newQuantity} ${feed.unit} (Soglia: ${feed.threshold} ${feed.unit}).`,
        date: new Date().toISOString().split('T')[0],
        type: 'feed',
        isRead: false,
        userId: user.id,
        createdAt: Date.now()
      });
    }

    setIsTransModalOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase mb-2">Magazzino Alimentare</h1>
          <p className="font-serif italic text-sm uppercase opacity-60">Controllo scorte e prelievi</p>
        </div>
        <div className="flex space-x-2">
           <button type="button" onClick={() => setIsStockModalOpen(true)} className="flex items-center text-xs border border-[var(--fg-color)] bg-[var(--card-bg)] text-[var(--fg-color)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer">
            <Plus size={14} className="mr-2" /> Nuovo Articolo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           <h2 className="text-xl font-bold uppercase tracking-tighter border-b border-[var(--fg-color)] pb-2">Inventario Attuale</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stocks.map(stock => {
                const isLow = stock.quantity < stock.threshold;
                return (
                  <div key={stock.id} className={`border border-[var(--fg-color)] p-5 shadow-[4px_4px_0px_0px_var(--fg-color)] transition-colors ${isLow ? 'bg-amber-100' : 'bg-[var(--card-bg)]'}`}>
                    <div className="flex justify-between items-start mb-4">
                       <h3 className="text-lg font-bold uppercase truncate pr-4">{stock.name}</h3>
                       {isLow && <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />}
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Disponibilità</p>
                        <p className="text-3xl font-mono tracking-tighter">{stock.quantity} <span className="text-sm font-sans">{stock.unit}</span></p>
                      </div>
                      <div>
                         <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Soglia Invio Alert</p>
                         <p className="text-sm font-mono text-right">{stock.threshold} {stock.unit}</p>
                      </div>
                    </div>
                    <div className="mt-6 flex space-x-2 border-t border-[var(--fg-color)] pt-4">
                      <button onClick={() => { setSelectedFeedId(stock.id); setTransType('purchase'); setIsTransModalOpen(true); }} className="flex-1 flex justify-center items-center py-2 px-2 border border-[var(--fg-color)] bg-[var(--fg-color)] text-[var(--bg-color)] text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--bg-color)] hover:text-[var(--fg-color)] transition-colors">
                        <ArrowUp size={12} className="mr-1" /> Carico
                      </button>
                      <button onClick={() => { setSelectedFeedId(stock.id); setTransType('consumption'); setIsTransModalOpen(true); }} className="flex-1 flex justify-center items-center py-2 px-2 border border-[var(--fg-color)] bg-[var(--card-bg)] text-[var(--fg-color)] text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors">
                        <ArrowDown size={12} className="mr-1" /> Scarico
                      </button>
                    </div>
                  </div>
                );
              })}
              {stocks.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs font-mono uppercase opacity-50 border border-[var(--fg-color)] border-dashed">
                  Nessun articolo a magazzino.
                </div>
              )}
           </div>
        </div>
        <div className="space-y-6">
           <h2 className="text-xl font-bold uppercase tracking-tighter border-b border-[var(--fg-color)] pb-2">Registro Movimenti</h2>
           <div className="border border-[var(--fg-color)] shadow-[4px_4px_0px_0px_var(--fg-color)] bg-[var(--card-bg)] overflow-hidden max-h-[600px] overflow-y-auto">
             <ul className="divide-y divide-[var(--fg-color)]">
                {transactions.length === 0 ? (
                  <li className="p-6 text-center text-xs font-mono opacity-50 uppercase tracking-widest">Syslog vuoto</li>
                ) : (
                  transactions.map(t => {
                    const feed = stocks.find(s => s.id === t.feedId);
                    return (
                      <li key={t.id} className="p-4 flex flex-col hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] group transition-colors cursor-default">
                        <div className="flex justify-between items-start mb-2">
                           <span className={`text-[10px] font-bold uppercase tracking-widest border border-[var(--fg-color)] group-hover:border-[var(--bg-color)] px-1.5 py-0.5 ${t.type === 'purchase' ? 'bg-green-100 group-hover:bg-green-600 group-hover:text-white' : 'bg-red-100 group-hover:bg-red-600 group-hover:text-white'}`}>
                             {t.type === 'purchase' ? 'Carico' : 'Scarico'}
                           </span>
                           <span className="text-[10px] font-mono opacity-60">{t.date}</span>
                        </div>
                        <p className="text-sm font-bold uppercase truncate">{feed?.name || 'Item Rimosso'}</p>
                        <p className="font-mono text-lg font-bold my-1">{t.type === 'purchase' ? '+' : '-'}{t.amount} <span className="text-[10px] uppercase font-sans tracking-widest font-normal">{feed?.unit || '-'}</span></p>
                        {t.notes && <p className="text-[10px] font-serif italic opacity-70 mt-1 truncate">{t.notes}</p>}
                      </li>
                    );
                  })
                )}
             </ul>
           </div>
        </div>
      </div>

      {isStockModalOpen && (
         <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setIsStockModalOpen(false)}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
              <form onSubmit={handleCreateStock}>
                <div className="p-8">
                   <div className="flex justify-between items-start border-b border-[var(--fg-color)] pb-4 mb-6">
                    <div>
                      <h3 className="text-2xl font-bold tracking-tighter uppercase mb-1">Nuovo Articolo</h3>
                      <p className="font-serif italic text-[11px] uppercase opacity-60">Setup anagrafica magazzino</p>
                    </div>
                    <button type="button" onClick={() => setIsStockModalOpen(false)} className="text-[var(--fg-color)] hover:opacity-50"><X size={24} /></button>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Nome Articolo *</label>
                      <input required type="text" name="name" placeholder="es. Fieno, Mais, Mangime X" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm font-bold uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] shadow-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Soglia Alert *</label>
                        <input required type="number" name="threshold" placeholder="0" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 font-mono text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                      </div>
                      <div>
                         <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Unità *</label>
                         <select required name="unit" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 font-mono text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]">
                            <option value="KG">KG</option>
                            <option value="L">Litri</option>
                            <option value="PZ">Pezzi</option>
                            <option value="B">Balle</option>
                         </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-[var(--bg-color)] px-8 py-4 border-t border-[var(--fg-color)]">
                  <button type="submit" className="w-full justify-center border border-transparent bg-[var(--fg-color)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--card-bg)] hover:border-[var(--fg-color)] hover:text-[var(--fg-color)] transition-colors active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                    Aggiungi a Catalogo
                  </button>
                </div>
              </form>
            </div>
          </div>
         </div>
      )}

      {isTransModalOpen && (
         <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setIsTransModalOpen(false)}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
              <form onSubmit={handleTransaction}>
                <div className="p-8">
                  <div className="flex justify-between items-start border-b border-[var(--fg-color)] pb-4 mb-6">
                    <div>
                      <h3 className="text-2xl font-bold tracking-tighter uppercase mb-1">{transType === 'purchase' ? 'Registra Carico' : 'Registra Scarico'}</h3>
                      <p className="font-serif italic text-[11px] uppercase opacity-60">Movimento Magazzino</p>
                    </div>
                    <button type="button" onClick={() => setIsTransModalOpen(false)} className="text-[var(--fg-color)] hover:opacity-50"><X size={24} /></button>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data *</label>
                      <input required type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Quantità *</label>
                      <input required type="number" step="0.01" name="amount" min="0.01" max={transType==='consumption' ? stocks.find(s=>s.id===selectedFeedId)?.quantity : undefined} className="block w-full border border-[var(--fg-color)] bg-[var(--bg-color)] py-3 px-4 text-2xl font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Note / Lott / Destinazione (Opzionale)</label>
                      <input type="text" name="notes" placeholder={transType === 'purchase' ? 'Fornitore, Ddt...' : 'Gruppo A, Mangiatoia 2...'} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                  </div>
                </div>
                <div className="bg-[var(--bg-color)] px-8 py-4 border-t border-[var(--fg-color)]">
                  <button type="submit" className="w-full justify-center border border-[var(--fg-color)] bg-[var(--fg-color)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--card-bg)] hover:text-[var(--fg-color)] transition-colors active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                    Conferma Movimento
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
