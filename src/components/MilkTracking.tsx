import { useState, useEffect, FormEvent } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Animal, MilkRecord } from '../types';
import { Plus, X, BarChart3, TrendingUp, Trophy } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function MilkTracking({ user }: { user: User }) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [records, setRecords] = useState<MilkRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const qAnimals = query(collection(db, 'animals'), where('userId', '==', user.uid), where('gender', '==', 'F'));
    const unsubAnimals = onSnapshot(qAnimals, (snapshot) => {
      setAnimals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Animal)));
    });

    const qRecords = query(collection(db, 'milkRecords'), where('userId', '==', user.uid));
    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      setRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MilkRecord)).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    });

    return () => { unsubAnimals(); unsubRecords(); };
  }, [user.uid]);

  const handleAddRecord = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await addDoc(collection(db, 'milkRecords'), {
        animalId: fd.get('animalId'),
        date: fd.get('date'),
        yieldAmount: Number(fd.get('yieldAmount')),
        userId: user.uid,
        createdAt: Date.now()
    });
    setIsModalOpen(false);
  };

  // Group records by Date to get Daily Totals
  const dailyTotals = records.reduce((acc, curr) => {
     acc[curr.date] = (acc[curr.date] || 0) + curr.yieldAmount;
     return acc;
  }, {} as Record<string, number>);

  const chartData = Object.keys(dailyTotals).map(date => ({
      date: date.substring(5), // mm-dd
      totale: dailyTotals[date]
  })).slice(-14);

  // Group by animal to get top performers in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const animalStats = animals.map(a => {
      const animalRecords = records.filter(r => r.animalId === a.id && new Date(r.date) >= thirtyDaysAgo);
      const totalYield = animalRecords.reduce((sum, r) => sum + r.yieldAmount, 0);
      const avgYield = animalRecords.length > 0 ? (totalYield / animalRecords.length).toFixed(1) : '0.0';
      return {
          ...a,
          totalYield,
          avgYield,
          recordCount: animalRecords.length
      };
  }).filter(a => a.totalYield > 0).sort((a, b) => b.totalYield - a.totalYield);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase mb-2">Produzione Latte</h1>
          <p className="font-serif italic text-sm uppercase opacity-60">Statistiche e registri di mungitura</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center text-xs border border-[#141414] bg-[#141414] text-[#E4E3E0] px-4 py-3 font-bold uppercase tracking-widest hover:bg-white hover:text-[#141414] transition-colors shadow-[2px_2px_0px_0px_#141414] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
          <Plus size={14} className="mr-2" /> Registra Mungitura
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold uppercase tracking-tighter border-b border-[#141414] pb-2 flex items-center"><BarChart3 size={20} className="mr-2" /> Andamento (Ultimi 14 Giorni)</h2>
            <div className="border border-[#141414] bg-white p-6 shadow-[4px_4px_0px_0px_#141414]">
               {chartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs font-mono opacity-50 uppercase tracking-widest border border-dashed border-[#141414]">Nessun dato temporale</div>
               ) : (
                  <div className="h-72 w-full font-mono text-xs">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke="#D8D7D3" vertical={false} />
                           <XAxis dataKey="date" stroke="#141414" fontSize={10} tickLine={false} axisLine={true} tickMargin={10} />
                           <YAxis stroke="#141414" fontSize={10} tickLine={false} axisLine={true} tickMargin={10} unit="L" />
                           <Tooltip cursor={{ fill: '#E4E3E0' }} contentStyle={{ borderRadius: '0', border: '1px solid #141414', boxShadow: '4px 4px 0px 0px #141414', backgroundColor: '#fff', color: '#141414', fontFamily: 'monospace' }} />
                           <Bar dataKey="totale" fill="#141414" radius={[2, 2, 0, 0]} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               )}
            </div>

            <h2 className="text-xl font-bold uppercase tracking-tighter border-b border-[#141414] pb-2 pt-6 flex items-center"><TrendingUp size={20} className="mr-2" /> Storico Registrazioni (Tutto)</h2>
            <div className="border border-[#141414] bg-white overflow-hidden shadow-[4px_4px_0px_0px_#141414]">
               <table className="min-w-full divide-y-2 divide-[#141414]">
                  <thead className="bg-[#E4E3E0]">
                     <tr>
                        <th scope="col" className="px-6 py-3 text-left font-bold text-[10px] uppercase tracking-widest opacity-80">Data</th>
                        <th scope="col" className="px-6 py-3 text-left font-bold text-[10px] uppercase tracking-widest opacity-80">Animale (Orecchino)</th>
                        <th scope="col" className="px-6 py-3 text-right font-bold text-[10px] uppercase tracking-widest opacity-80">Quantità (L)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414] bg-transparent">
                     {records.slice().reverse().slice(0, 50).map(r => {
                        const animal = animals.find(a => a.id === r.animalId);
                        return (
                           <tr key={r.id} className="hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group cursor-default">
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-mono opacity-80">{r.date}</td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                 <span className="font-bold border border-[#141414] group-hover:border-[#E4E3E0] px-2 py-0.5 bg-white text-[#141414]">{animal?.earTag || 'N/D'}</span>
                                 <span className="ml-2 font-serif italic text-xs opacity-70">{animal?.name || ''}</span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-right text-lg font-mono font-bold">
                                 {r.yieldAmount.toFixed(1)} <span className="text-[10px] uppercase font-sans font-normal opacity-60">L</span>
                              </td>
                           </tr>
                        );
                     })}
                     {records.length === 0 && (
                        <tr><td colSpan={3} className="px-6 py-8 text-center text-xs font-mono uppercase opacity-50">Nessuna mungitura registrata</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         <div className="space-y-6">
            <h2 className="text-xl font-bold uppercase tracking-tighter border-b border-[#141414] pb-2 flex items-center"><Trophy size={20} className="mr-2" /> Top Performers (30gg)</h2>
            <div className="space-y-4">
               {animalStats.length === 0 ? (
                  <div className="p-8 text-center border border-[#141414] border-dashed text-xs font-mono uppercase opacity-50">Nessun dato per il periodo</div>
               ) : (
                  animalStats.map((a, idx) => (
                     <div key={a.id} className="border border-[#141414] p-4 bg-[#E4E3E0] relative shadow-[4px_4px_0px_0px_#141414]">
                        <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center font-mono font-bold text-[#141414] bg-white border-b border-l border-[#141414]">
                           #{idx + 1}
                        </div>
                        <div className="flex justify-between items-end mb-2">
                           <div>
                              <p className="font-bold text-lg font-mono tracking-tighter uppercase">{a.earTag}</p>
                              <p className="text-[10px] font-serif italic uppercase opacity-60 leading-tight">{a.name || 'Senza Nome'} - {a.breed}</p>
                           </div>
                        </div>
                        <div className="flex gap-4 mt-4 border-t border-[#141414]/30 pt-3">
                           <div>
                              <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Totale Mese</p>
                              <p className="text-xl font-mono tracking-tighter">{a.totalYield.toFixed(1)} <span className="text-xs">L</span></p>
                           </div>
                           <div className="border-l border-[#141414]/30 pl-4">
                              <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Media gg</p>
                              <p className="text-xl font-mono tracking-tighter">{a.avgYield} <span className="text-xs">L</span></p>
                           </div>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>

      {isModalOpen && (
         <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-[#141414]/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative inline-block align-bottom bg-white border border-[#141414] shadow-[8px_8px_0px_0px_#141414] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
              <form onSubmit={handleAddRecord}>
                <div className="p-8">
                   <div className="flex justify-between items-start border-b border-[#141414] pb-4 mb-6">
                    <div>
                      <h3 className="text-2xl font-bold tracking-tighter uppercase mb-1">Dati Mungitura</h3>
                      <p className="font-serif italic text-[11px] uppercase opacity-60">Inserimento produzione individuale</p>
                    </div>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-[#141414] hover:opacity-50"><X size={24} /></button>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Animale *</label>
                      <select required name="animalId" className="block w-full border border-[#141414] bg-[#E4E3E0] py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[#141414]">
                         <option value="">-- Seleziona Capo --</option>
                         {animals.map(a => (
                            <option key={a.id} value={a.id}>{a.earTag} {a.name ? `- ${a.name}` : ''}</option>
                         ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data Rilevazione *</label>
                      <input required type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="block w-full border border-[#141414] bg-white py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[#141414]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Volume Prodotto (Litri) *</label>
                      <input required type="number" step="0.1" name="yieldAmount" min="0.1" className="block w-full border border-[#141414] bg-white py-3 px-4 text-2xl font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[#141414]" />
                    </div>
                  </div>
                </div>
                <div className="bg-[#E4E3E0] px-8 py-4 border-t border-[#141414]">
                  <button type="submit" className="w-full justify-center border border-[#141414] bg-[#141414] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[#E4E3E0] shadow-[2px_2px_0px_0px_#141414] hover:bg-white hover:text-[#141414] transition-colors active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                    Salva Registrazione
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
