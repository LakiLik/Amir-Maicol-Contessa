import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Animal, Treatment, WeightRecord } from '../types';
import { db } from '../lib/db-mock';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, addDoc } from '../lib/db-mock';
import { subscribeToTreatments, subscribeToWeights, addTreatment, addWeightRecord, updateAnimal } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Stethoscope, Scale, GitMerge, FileText, Image as ImageIcon, Camera, UploadCloud, X } from 'lucide-react';
import FamilyTree from './FamilyTree';

interface DetailProps {
  user: User;
}

export default function AnimalDetail({ user }: DetailProps) {
  const { id } = useParams<{ id: string }>();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Subcollections data
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);

  // Family data
  const [mother, setMother] = useState<Animal | null>(null);
  const [father, setFather] = useState<Animal | null>(null);
  const [children, setChildren] = useState<Animal[]>([]);

  // UI state
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'health' | 'weight' | 'family' | 'photos'>('health');

  useEffect(() => {
    if (!id) return;
    
    // Fetch main animal
    const fetchAnimal = async () => {
      const docRef = doc(db, 'animals', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Animal;
        setAnimal(data);
        
        // Fetch parents
        if (data.motherId) {
          getDoc(doc(db, 'animals', data.motherId)).then(m => m.exists() && setMother({ id: m.id, ...m.data() } as Animal));
        }
        if (data.fatherId) {
          getDoc(doc(db, 'animals', data.fatherId)).then(f => f.exists() && setFather({ id: f.id, ...f.data() } as Animal));
        }
        
        // Fetch children
        const colRef = collection(db, 'animals');
        const qMother = query(colRef, where('motherId', '==', id));
        const qFather = query(colRef, where('fatherId', '==', id));
        
        Promise.all([getDocs(qMother), getDocs(qFather)]).then(([mSnaps, fSnaps]) => {
          const kidsMap = new Map();
          mSnaps.docs.forEach(d => kidsMap.set(d.id, { id: d.id, ...d.data() }));
          fSnaps.docs.forEach(d => kidsMap.set(d.id, { id: d.id, ...d.data() }));
          setChildren(Array.from(kidsMap.values()));
        });
      }
      setLoading(false);
    };

    fetchAnimal();

    const unsubT = subscribeToTreatments(id, setTreatments);
    const unsubW = subscribeToWeights(id, setWeights);
    const unsubP = onSnapshot(collection(db, 'animals', id, 'photos'), (snap) => {
      setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
    });

    return () => {
      unsubT();
      unsubW();
      unsubP();
    };
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Caricamento...</div>;
  if (!animal) return <div className="p-8 text-center text-red-500">Animale non trovato.</div>;

  const handleAddTreatment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;
    const formData = new FormData(e.currentTarget);
    await addTreatment(id, {
      date: formData.get('date') as string,
      type: formData.get('type') as string,
      description: formData.get('description') as string,
      medicine: formData.get('medicine') as string,
      nextDueDate: formData.get('nextDueDate') as string,
      userId: user.id,
    });
    setShowTreatmentModal(false);
  };

  const handleAddWeight = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;
    const formData = new FormData(e.currentTarget);
    await addWeightRecord(id, {
      date: formData.get('date') as string,
      weight: parseFloat(formData.get('weight') as string),
      userId: user.id,
    });
    setShowWeightModal(false);
  };

  // Sort data for charts/lists
  const sortedWeights = [...weights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const sortedTreatments = [...treatments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Growth Prediction calculation
  let chartData: any[] = [];
  if (sortedWeights.length > 0) {
     chartData = sortedWeights.map(w => ({ date: w.date, weight: w.weight, predictedWeight: null }));

     if (sortedWeights.length >= 2) {
       const minTime = new Date(sortedWeights[0].date).getTime();
       let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
       const n = sortedWeights.length;
       sortedWeights.forEach(r => {
          const x = (new Date(r.date).getTime() - minTime) / (1000 * 3600 * 24);
          const y = r.weight;
          sumX += x;
          sumY += y;
          sumXY += x * y;
          sumX2 += x * x;
       });
       
       const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
       // Check if m is valid number
       if (isFinite(m)) {
          const b = (sumY - m * sumX) / n;
          const lastRecord = sortedWeights[sortedWeights.length - 1];
          const lastTime = new Date(lastRecord.date).getTime();
          
          chartData[chartData.length - 1].predictedWeight = lastRecord.weight;

          for(let i = 1; i <= 3; i++) {
              const futTime = lastTime + i * 30 * 24 * 3600 * 1000;
              const futX = (futTime - minTime) / (1000 * 3600 * 24);
              const predY = m * futX + b;
              if (predY > 0) {
                 chartData.push({
                     date: new Date(futTime).toISOString().split('T')[0],
                     weight: null,
                     predictedWeight: Number(predY.toFixed(1))
                 });
              }
          }
       }
     }
  }

  const handleAddPhoto = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;
    const formData = new FormData(e.currentTarget);
    await addDoc(collection(db, 'animals', id, 'photos'), {
      url: formData.get('url'),
      description: formData.get('description') || '',
      userId: user.id,
      createdAt: Date.now()
    });
    setIsPhotoModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-20">
      <Link to="/grid" className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] hover:opacity-70 transition-opacity">
        <ArrowLeft size={16} className="mr-1" /> Torna alla griglia
      </Link>

      <div className="bg-[var(--card-bg)] border border-[var(--fg-color)] overflow-hidden shadow-[4px_4px_0px_0px_var(--fg-color)]">
        <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-start border-b border-[var(--fg-color)]">
          {animal.photoUrl ? (
            <img src={animal.photoUrl} alt="" className="w-32 h-32 md:w-48 md:h-48 object-cover border border-[var(--fg-color)] grayscale hover:grayscale-0 transition-all shadow-[2px_2px_0px_0px_var(--fg-color)]" />
          ) : (
            <div className="w-32 h-32 md:w-48 md:h-48 bg-[var(--bg-color)] border border-[var(--fg-color)] flex items-center justify-center shadow-[2px_2px_0px_0px_var(--fg-color)]">
              <span className="text-[var(--fg-color)] font-mono font-bold text-4xl">{animal.species?.[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 w-full">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold text-[var(--fg-color)] font-mono tracking-tighter uppercase">{animal.earTag}</h1>
                <p className="text-sm font-serif italic text-[var(--fg-color)] opacity-60 uppercase">{animal.name || 'Senza nome'}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 border border-[var(--fg-color)] text-[10px] font-bold uppercase tracking-widest ${
                animal.healthStatus?.toLowerCase() === 'sano' || animal.healthStatus?.toLowerCase() === 'healthy'
                ? 'bg-green-200 text-[var(--fg-color)]' 
                : 'bg-red-200 text-[var(--fg-color)]'
              }`}>
                {animal.healthStatus}
              </span>
            </div>
            
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
              <div className="border border-[var(--fg-color)] bg-[var(--bg-color)]/30 p-3 shadow-[2px_2px_0px_0px_var(--fg-color)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] opacity-70 mb-1">Specie</p>
                <p className="text-[var(--fg-color)] font-mono font-bold uppercase">{animal.species}</p>
              </div>
              <div className="border border-[var(--fg-color)] bg-[var(--bg-color)]/30 p-3 shadow-[2px_2px_0px_0px_var(--fg-color)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] opacity-70 mb-1">Razza</p>
                <p className="text-[var(--fg-color)] font-serif italic">{animal.breed || '-'}</p>
              </div>
              <div className="border border-[var(--fg-color)] bg-[var(--bg-color)]/30 p-3 shadow-[2px_2px_0px_0px_var(--fg-color)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] opacity-70 mb-1">Data Nascita</p>
                <p className="text-[var(--fg-color)] font-mono font-bold">{animal.dateOfBirth}</p>
              </div>
              <div className="border border-[var(--fg-color)] bg-[var(--bg-color)]/30 p-3 shadow-[2px_2px_0px_0px_var(--fg-color)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] opacity-70 mb-1">Peso Rilevato</p>
                <p className="text-[var(--fg-color)] font-mono font-bold">{animal.currentWeight ? `${animal.currentWeight} KG` : '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[#D8D7D3]">
          <nav className="flex divide-x divide-[var(--fg-color)]">
            <button onClick={() => setActiveTab('health')} className={`flex-1 whitespace-nowrap flex justify-center py-4 px-1 font-bold text-[11px] uppercase tracking-widest transition-colors ${activeTab === 'health' ? 'bg-[var(--fg-color)] text-[var(--bg-color)]' : 'text-[var(--fg-color)] hover:bg-[var(--card-bg)]'}`}>
              <Stethoscope className="mr-2 h-4 w-4" /> Salute & Cure
            </button>
            <button onClick={() => setActiveTab('weight')} className={`flex-1 whitespace-nowrap flex justify-center py-4 px-1 font-bold text-[11px] uppercase tracking-widest transition-colors ${activeTab === 'weight' ? 'bg-[var(--fg-color)] text-[var(--bg-color)]' : 'text-[var(--fg-color)] hover:bg-[var(--card-bg)]'}`}>
              <Scale className="mr-2 h-4 w-4" /> Monitoraggio Peso
            </button>
            <button onClick={() => setActiveTab('family')} className={`flex-1 whitespace-nowrap flex justify-center py-4 px-1 font-bold text-[11px] uppercase tracking-widest transition-colors ${activeTab === 'family' ? 'bg-[var(--fg-color)] text-[var(--bg-color)]' : 'text-[var(--fg-color)] hover:bg-[var(--card-bg)]'}`}>
              <GitMerge className="mr-2 h-4 w-4" /> Albero Genealogico
            </button>
            <button onClick={() => setActiveTab('photos')} className={`flex-1 whitespace-nowrap flex justify-center py-4 px-1 font-bold text-[11px] uppercase tracking-widest transition-colors ${activeTab === 'photos' ? 'bg-[var(--fg-color)] text-[var(--bg-color)]' : 'text-[var(--fg-color)] hover:bg-[var(--card-bg)]'}`}>
              <ImageIcon className="mr-2 h-4 w-4" /> Galleria Foto
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'health' && (
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold tracking-tighter uppercase">Storico Logs</h2>
                <p className="font-serif italic text-[11px] uppercase opacity-60">Attività mediche e di routine</p>
              </div>
              <button onClick={() => setShowTreatmentModal(true)} className="inline-flex items-center text-[10px] border border-[var(--fg-color)] bg-[var(--fg-color)] text-[var(--bg-color)] px-3 py-2 font-bold uppercase tracking-widest hover:bg-[var(--bg-color)] hover:text-[var(--fg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none">
                Nuovo Log
              </button>
            </div>
            <div className="bg-[var(--card-bg)] border border-[var(--fg-color)] overflow-hidden shadow-[4px_4px_0px_0px_var(--fg-color)]">
               {sortedTreatments.length === 0 ? (
                 <div className="p-8 text-center text-xs font-mono opacity-50 uppercase tracking-widest">Syslog vuoto.</div>
               ) : (
                 <ul className="divide-y divide-[var(--fg-color)]">
                   {sortedTreatments.map(t => (
                     <li key={t.id} className="p-6 hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors group">
                       <div className="flex justify-between items-start">
                         <div>
                           <p className="text-sm font-bold uppercase tracking-wider">{t.type} <span className="font-mono text-xs opacity-60 ml-2">[{t.date}]</span></p>
                           <p className="mt-2 text-sm font-serif">{t.description}</p>
                           {t.medicine && <p className="mt-3 text-[10px] font-mono uppercase tracking-widest border border-[var(--fg-color)] group-hover:border-[var(--bg-color)] inline-block px-2 py-1 shadow-[2px_2px_0px_0px_var(--fg-color)] group-hover:shadow-[var(--bg-color)]">Med: {t.medicine}</p>}
                         </div>
                         {t.nextDueDate && (
                           <div className="text-right flex flex-col border border-[var(--fg-color)] group-hover:border-[var(--bg-color)] p-2 bg-[var(--bg-color)] group-hover:bg-[var(--fg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] group-hover:shadow-[2px_2px_0px_0px_var(--bg-color)]">
                             <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">Next Alert</span>
                             <span className="text-xs font-mono font-bold mt-1">{t.nextDueDate}</span>
                           </div>
                         )}
                       </div>
                     </li>
                   ))}
                 </ul>
               )}
            </div>
          </div>
        )}

        {activeTab === 'weight' && (
          <div className="space-y-4">
             <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold tracking-tighter uppercase">Telemetria Peso</h2>
                <p className="font-serif italic text-[11px] uppercase opacity-60">Variazioni massa (KG)</p>
              </div>
              <button onClick={() => setShowWeightModal(true)} className="inline-flex items-center text-[10px] border border-[var(--fg-color)] bg-[var(--fg-color)] text-[var(--bg-color)] px-3 py-2 font-bold uppercase tracking-widest hover:bg-[var(--bg-color)] hover:text-[var(--fg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none">
                Input Dati
              </button>
            </div>
            <div className="bg-[var(--card-bg)] border border-[var(--fg-color)] p-6 shadow-[4px_4px_0px_0px_var(--fg-color)]">
              {chartData.length === 0 ? (
                 <div className="p-8 text-center text-xs font-mono opacity-50 uppercase tracking-widest">Nessun punto dati.</div>
              ) : (
                <div className="h-72 w-full font-mono text-xs relative">
                  <div className="absolute top-2 right-2 flex items-center gap-4 text-[9px] uppercase font-bold tracking-widest z-10">
                     <span className="flex items-center gap-1"><div className="w-3 h-3 bg-[var(--fg-color)] animate-pulse"></div> Storico</span>
                     <span className="flex items-center gap-1"><div className="w-3 h-px border-b-2 border-dashed border-[var(--fg-color)]"></div> Proiezione (3 mesi)</span>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData} margin={{ top: 15, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D8D7D3" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--fg-color)" fontSize={10} tickLine={false} axisLine={true} tickMargin={10} />
                      <YAxis stroke="var(--fg-color)" fontSize={10} tickLine={false} axisLine={true} tickMargin={10} unit="kg" />
                      <Tooltip contentStyle={{ borderRadius: '0', border: '1px solid var(--fg-color)', boxShadow: '4px 4px 0px 0px var(--fg-color)', backgroundColor: '#fff', color: 'var(--fg-color)', fontFamily: 'monospace' }} />
                      <Line type="stepAfter" dataKey="weight" name="Storico" stroke="var(--fg-color)" strokeWidth={2} dot={{ fill: 'var(--bg-color)', stroke: 'var(--fg-color)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: 'var(--fg-color)', stroke: 'var(--bg-color)' }} />
                      <Line type="monotone" dataKey="predictedWeight" name="Proiezione" stroke="var(--fg-color)" strokeWidth={2} strokeDasharray="4 4" dot={{ fill: 'transparent', stroke: 'var(--fg-color)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: 'var(--bg-color)', stroke: 'var(--fg-color)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'family' && (
          <FamilyTree currentAnimalId={animal.id} userId={user.id} />
        )}
        {activeTab === 'photos' && (
          <div className="space-y-4">
             <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold tracking-tighter uppercase">Archivio Fotografico</h2>
                <p className="font-serif italic text-[11px] uppercase opacity-60">Diario visivo della crescita</p>
              </div>
              <button onClick={() => setIsPhotoModalOpen(true)} className="inline-flex items-center text-[10px] border border-[var(--fg-color)] bg-[var(--fg-color)] text-[var(--bg-color)] px-3 py-2 font-bold uppercase tracking-widest hover:bg-[var(--bg-color)] hover:text-[var(--fg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none">
                <UploadCloud size={14} className="mr-1" /> Aggiungi Foto
              </button>
            </div>
            {photos.length === 0 ? (
               <div className="border border-[var(--fg-color)] bg-[var(--card-bg)] p-12 text-center shadow-[4px_4px_0px_0px_var(--fg-color)]">
                 <ImageIcon className="mx-auto h-8 w-8 opacity-30 mb-2" />
                 <p className="text-sm font-mono uppercase opacity-50 tracking-widest">Nessuna foto archiviata</p>
               </div>
            ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {photos.map(p => (
                     <div key={p.id} className="border border-[var(--fg-color)] bg-[var(--card-bg)] shadow-[4px_4px_0px_0px_var(--fg-color)] overflow-hidden group">
                        <div className="aspect-square w-full overflow-hidden border-b border-[var(--fg-color)]">
                           <img src={p.url} alt={p.description || 'Foto animale'} className="w-full h-full object-cover grayscale transition-all duration-300 group-hover:grayscale-0 group-hover:scale-105" />
                        </div>
                        {p.description && (
                           <div className="p-3">
                              <p className="text-[10px] font-mono uppercase tracking-widest opacity-80 truncate">{p.description}</p>
                              <p className="text-[8px] font-sans opacity-50 mt-1">{new Date(p.createdAt).toLocaleDateString()}</p>
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showTreatmentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setShowTreatmentModal(false)}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
              <form onSubmit={handleAddTreatment}>
                <div className="p-8">
                  <h3 className="text-2xl font-bold tracking-tighter uppercase mb-2">Nuovo Log Medico</h3>
                  <p className="font-serif italic text-[11px] uppercase opacity-60 mb-6 border-b border-[var(--fg-color)] pb-4">Registrazione evento</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data *</label>
                      <input required type="date" name="date" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Tipo *</label>
                      <input required type="text" name="type" placeholder="es. VACCINO, VISITA" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Descrizione *</label>
                      <textarea required name="description" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" rows={3}></textarea>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Medicina</label>
                      <input type="text" name="medicine" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Prossima Scadenza</label>
                      <input type="date" name="nextDueDate" className="block w-full border border-[var(--fg-color)] bg-[var(--bg-color)]/30 py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                  </div>
                </div>
                <div className="bg-[var(--bg-color)] px-8 py-4 flex flex-row-reverse border-t border-[var(--fg-color)] gap-3">
                  <button type="submit" className="inline-flex justify-center border border-transparent bg-[var(--fg-color)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--card-bg)] hover:border-[var(--fg-color)] hover:text-[var(--fg-color)] focus:outline-none focus:ring-0 active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                    Salva
                  </button>
                  <button type="button" onClick={() => setShowTreatmentModal(false)} className="inline-flex justify-center border border-[var(--fg-color)] bg-[var(--card-bg)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--bg-color)] focus:outline-none focus:ring-0 active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showWeightModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
           <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setShowWeightModal(false)}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-sm w-full">
              <form onSubmit={handleAddWeight}>
                <div className="p-8">
                  <h3 className="text-2xl font-bold tracking-tighter uppercase mb-2">Input Telemetria</h3>
                  <p className="font-serif italic text-[11px] uppercase opacity-60 mb-6 border-b border-[var(--fg-color)] pb-4">Nuova rilevazione peso</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data *</label>
                      <input required type="date" name="date" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Massa (KG) *</label>
                      <input required type="number" step="0.1" name="weight" className="block w-full border border-[var(--fg-color)] bg-[var(--bg-color)] py-2 px-3 text-2xl font-mono focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                  </div>
                </div>
                 <div className="bg-[var(--bg-color)] px-8 py-4 flex flex-row-reverse border-t border-[var(--fg-color)] gap-3">
                  <button type="submit" className="inline-flex justify-center border border-transparent bg-[var(--fg-color)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--card-bg)] hover:border-[var(--fg-color)] hover:text-[var(--fg-color)] focus:outline-none focus:ring-0 active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                    Registra
                  </button>
                  <button type="button" onClick={() => setShowWeightModal(false)} className="inline-flex justify-center border border-[var(--fg-color)] bg-[var(--card-bg)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--bg-color)] focus:outline-none focus:ring-0 active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
           <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setIsPhotoModalOpen(false)}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-sm w-full">
              <form onSubmit={handleAddPhoto}>
                <div className="p-8">
                  <div className="flex justify-between items-start border-b border-[var(--fg-color)] pb-4 mb-6">
                    <div>
                      <h3 className="text-2xl font-bold tracking-tighter uppercase mb-1">Nuova Foto</h3>
                      <p className="font-serif italic text-[11px] uppercase opacity-60">Inserisci l'URL dell'immagine</p>
                    </div>
                    <button type="button" onClick={() => setIsPhotoModalOpen(false)} className="text-[var(--fg-color)] hover:opacity-50"><X size={24} /></button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                       <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">URL Immagine *</label>
                       <input required type="url" name="url" placeholder="https://" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div>
                       <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Descrizione (Opzionale)</label>
                       <input type="text" name="description" placeholder="Es. Pascolo estivo" className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                  </div>
                </div>
                <div className="bg-[var(--bg-color)] px-8 py-4 flex flex-row-reverse border-t border-[var(--fg-color)] gap-3">
                  <button type="submit" className="inline-flex justify-center border border-transparent bg-[var(--fg-color)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--card-bg)] hover:border-[var(--fg-color)] hover:text-[var(--fg-color)] focus:outline-none focus:ring-0 active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                    Salva
                  </button>
                  <button type="button" onClick={() => setIsPhotoModalOpen(false)} className="inline-flex justify-center border border-[var(--fg-color)] bg-[var(--card-bg)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--bg-color)] focus:outline-none focus:ring-0 active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                    Annulla
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
