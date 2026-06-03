import { useEffect, useState, FormEvent } from 'react';
import { User } from 'firebase/auth';
import { subscribeToAnimals } from '../lib/api';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Animal, WeightRecord } from '../types';
import { Activity, Users, AlertCircle, Calendar, CloudRain, Sun, Cloud, Thermometer, Wind, SmartphoneNfc } from 'lucide-react';
import { format, isAfter, subDays, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { addDoc, doc, updateDoc, increment } from 'firebase/firestore';

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [weightData, setWeightData] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quickAction, setQuickAction] = useState<'none' | 'animal' | 'weight' | 'feed'>('none');
  const [feedStocks, setFeedStocks] = useState<any[]>([]);

  useEffect(() => {
    // Quick Actions setup
    const qFeed = query(collection(db, 'feedStocks'), where('userId', '==', user.uid));
    getDocs(qFeed).then(snap => {
       setFeedStocks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub = subscribeToAnimals(user.uid, async (data) => {
      setAnimals(data);
      
      // Fetch weight records to calculate monthly averages
      const q = query(collection(db, 'weightRecords'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const records: WeightRecord[] = [];
      querySnapshot.forEach((doc) => {
         records.push({ id: doc.id, ...doc.data() } as WeightRecord);
      });

      // Group by month YYYY-MM
      const monthlyData: Record<string, { total: number; count: number }> = {};
      records.forEach(r => {
         const month = r.date.substring(0, 7); // "2024-05"
         if (!monthlyData[month]) monthlyData[month] = { total: 0, count: 0 };
         monthlyData[month].total += r.weight;
         monthlyData[month].count += 1;
      });

      const chartData = Object.keys(monthlyData).sort().map(month => ({
         month,
         media: Number((monthlyData[month].total / monthlyData[month].count).toFixed(1))
      }));

      setWeightData(chartData);
      setLoading(false);
    });

    // Fetch Weather (Default: Rome coordinates)
    // Attempt standard coordinates or let open-meteo auto-resolve by IP (not supported directly by v1 without passing lat/lon)
    // We use a fixed fallback and try geolocation if possible.
    const fetchWeather = async (lat: number, lon: number) => {
       try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`);
          const data = await res.json();
          setWeather(data);
       } catch (error) {
          console.error("Meteo non disponibile", error);
       }
    };
    
    if (navigator.geolocation) {
       navigator.geolocation.getCurrentPosition(
          (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
          () => fetchWeather(41.9028, 12.4964) // fallback Rome
       );
    } else {
       fetchWeather(41.9028, 12.4964);
    }

    return () => unsub();
  }, [user.uid]);

  const totalAnimals = animals.length;
  const sickAnimals = animals.filter(a => a.healthStatus?.toLowerCase() !== 'sano' && a.healthStatus?.toLowerCase() !== 'healthy').length;
  
  const recentAdditions = [...animals].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  const healthyCount = animals.filter(a => ['sano', 'healthy'].includes(a.healthStatus?.toLowerCase() || '')).length;
  const sickCount = animals.filter(a => ['malato', 'sick'].includes(a.healthStatus?.toLowerCase() || '')).length;
  const obsCount = animals.filter(a => ['in osservazione', 'osservazione', 'observation'].includes(a.healthStatus?.toLowerCase() || '')).length;
  const otherCount = totalAnimals - healthyCount - sickCount - obsCount;
  
  const healthData = [
     { name: 'Sano', value: healthyCount, color: '#141414' }, // Black
     { name: 'Malato', value: sickCount, color: '#DC2626' }, // Red
     { name: 'In Osservazione', value: obsCount, color: '#D97706' }, // Amber
     { name: 'Altro', value: otherCount, color: '#9CA3AF' } // Gray
  ].filter(d => d.value > 0);

  const handleQuickAction = async (e: FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     const fd = new FormData(e.currentTarget);
     
     if (quickAction === 'animal') {
        const animalData = {
           earTag: fd.get('earTag') as string,
           species: fd.get('species') as string,
           dateOfBirth: fd.get('dateOfBirth') as string,
           healthStatus: 'Sano',
           userId: user.uid,
           createdAt: Date.now()
        };
        await addDoc(collection(db, 'animals'), animalData);
     } else if (quickAction === 'weight') {
        await addDoc(collection(db, 'weightRecords'), {
           animalId: fd.get('animalId'),
           date: fd.get('date'),
           weight: Number(fd.get('weight')),
           userId: user.uid,
           createdAt: Date.now()
        });
     } else if (quickAction === 'feed') {
        const type = fd.get('type') as string;
        const amount = Number(fd.get('amount'));
        const stockId = fd.get('stockId') as string;
        await addDoc(collection(db, 'feedTransactions'), {
           stockId,
           type,
           amount,
           date: new Date().toISOString().split('T')[0],
           notes: 'Aggiunta Rapida',
           userId: user.uid,
           createdAt: Date.now()
        });
        await updateDoc(doc(db, 'feedStocks', stockId), {
           quantity: increment(type === 'in' ? amount : -amount)
        });
     }
     setQuickAction('none');
  };

  const getWeatherIcon = (code: number) => {
      // 0: Clear, 1-3: Partly, 45-48: Fog, 51-67: Rain/Drizzle, 71-77: Snow, 95-99: Thunderstorm
      if (code === 0) return <Sun className="w-8 h-8 text-amber-500" />;
      if (code >= 1 && code <= 3) return <Cloud className="w-8 h-8 text-gray-400" />;
      if (code >= 51 && code <= 67) return <CloudRain className="w-8 h-8 text-blue-500" />;
      return <Cloud className="w-8 h-8 text-gray-400" />;
  };

  if (loading) {
    return <div className="animate-pulse space-y-6 flex flex-col pt-4">
      <div className="h-10 w-48 bg-gray-300 border border-[#141414]"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-300 border border-[#141414]"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter uppercase">Terminale Controllo</h1>
        <p className="mt-1 font-serif italic text-[11px] uppercase opacity-60">Panoramica dello stato mandria & sensori.</p>
      </div>

      {/* Top Grid: Stats & Weather */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Weather Widget */}
        <div className="col-span-1 md:col-span-2 p-6 border border-[#141414] bg-[#E4E3E0] shadow-[4px_4px_0px_0px_#141414] flex flex-row items-center justify-between">
            {weather ? (
               <>
                  <div>
                     <h3 className="font-serif italic text-[10px] uppercase opacity-50 mb-2">Stazione Meteo Locale</h3>
                     <div className="flex items-center gap-3">
                         {getWeatherIcon(weather.current_weather.weathercode)}
                         <span className="text-4xl font-bold font-mono tracking-tighter">{Math.round(weather.current_weather.temperature)}°</span>
                     </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                     <p className="text-[10px] font-bold uppercase tracking-widest"><Wind className="inline w-3 h-3 mr-1" /> Vento: {weather.current_weather.windspeed} km/h</p>
                     {weather.daily?.temperature_2m_max?.[0] && (
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">
                           Max: {Math.round(weather.daily.temperature_2m_max[0])}° / Min: {Math.round(weather.daily.temperature_2m_min[0])}°
                        </p>
                     )}
                     <p className="text-[8px] font-mono mt-3 opacity-50 uppercase">Synched: OpenMeteo DLT</p>
                  </div>
               </>
            ) : (
               <div className="text-xs font-mono uppercase opacity-50">Ricerca segnale meteo...</div>
            )}
        </div>

        <div className="p-4 border border-[#141414] bg-white shadow-[4px_4px_0px_0px_#141414] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="font-serif italic text-[10px] uppercase opacity-50">Capi Attivi</h3>
            <Users className="text-[#141414] w-4 h-4" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold font-mono">{totalAnimals}</span>
            <span className="ml-1 text-[10px] uppercase tracking-tighter">Totali</span>
          </div>
        </div>

        <div className="p-4 border border-[#141414] bg-[#141414] text-[#E4E3E0] shadow-[4px_4px_0px_0px_#141414] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="font-serif italic text-[10px] uppercase opacity-50">Allerte Mediche</h3>
            <AlertCircle className={`w-4 h-4 ${sickAnimals > 0 ? 'text-red-400' : 'text-[#E4E3E0]'}`} />
          </div>
          <div className="mt-4 flex items-baseline">
            <span className="text-3xl font-bold font-mono">{sickAnimals}</span>
            <span className="ml-1 text-[10px] uppercase tracking-tighter">Soggetti</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
         {/* Chart & Chart layout */}
         <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold uppercase tracking-tighter border-b border-[#141414] pb-2">Analisi Peso Mandria</h2>
            <div className="border border-[#141414] bg-white p-6 shadow-[4px_4px_0px_0px_#141414]">
               {weightData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs font-mono opacity-50 uppercase tracking-widest border border-dashed border-[#141414]">Dati insufficienti</div>
               ) : (
                  <div className="h-72 w-full font-mono text-xs">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weightData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                           <defs>
                              <linearGradient id="colorMedia" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#141414" stopOpacity={0.3}/>
                                 <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="#D8D7D3" vertical={false} />
                           <XAxis dataKey="month" stroke="#141414" fontSize={10} tickLine={false} axisLine={true} tickMargin={10} />
                           <YAxis stroke="#141414" fontSize={10} tickLine={false} axisLine={true} tickMargin={10} unit="kg" />
                           <Tooltip cursor={{ stroke: '#141414', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: '0', border: '1px solid #141414', boxShadow: '4px 4px 0px 0px #141414', backgroundColor: '#fff', color: '#141414', fontFamily: 'monospace' }} />
                           <Area type="monotone" dataKey="media" stroke="#141414" strokeWidth={2} fillOpacity={1} fill="url(#colorMedia)" activeDot={{ r: 6, fill: '#141414', stroke: '#E4E3E0', strokeWidth: 2 }} />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               )}
            </div>
         </div>

         {/* Sidebar col */}
         <div className="space-y-8">
            <div>
               <h2 className="text-xl font-bold uppercase tracking-tighter border-b border-[#141414] pb-2">Status Salute</h2>
               <div className="border border-[#141414] bg-white shadow-[4px_4px_0px_0px_#141414] mt-6 p-4">
                  {healthData.length === 0 ? (
                     <div className="py-10 text-center text-xs font-mono opacity-50">Nessun dato.</div>
                  ) : (
                     <div className="h-48 w-full font-mono text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                              <Pie data={healthData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                                 {healthData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                 ))}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: '0', border: '1px solid #141414', boxShadow: '2px 2px 0px 0px #141414', padding: '4px 8px' }} itemStyle={{ fontWeight: 'bold' }} />
                           </PieChart>
                        </ResponsiveContainer>
                     </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                     {healthData.map((d, i) => (
                        <div key={i} className="flex items-center text-[9px] uppercase font-bold tracking-widest"><div className="w-2 h-2 mr-1" style={{ backgroundColor: d.color }}></div>{d.name} ({d.value})</div>
                     ))}
                  </div>
               </div>
            </div>

            <div>
               <h2 className="text-xl font-bold uppercase tracking-tighter border-b border-[#141414] pb-2">Nuovi Capi</h2>
               <div className="border border-[#141414] bg-white shadow-[4px_4px_0px_0px_#141414] overflow-hidden mt-6">
               {recentAdditions.length === 0 ? (
                  <div className="px-6 py-10 text-center text-xs font-mono opacity-50">
                     Nessun record in DB.
                  </div>
               ) : (
                  <div className="divide-y divide-[#141414]">
                  {recentAdditions.map(animal => (
                     <div key={animal.id} className="p-4 hover:bg-[#141414] hover:text-[#E4E3E0] group transition-colors">
                        <div className="flex justify-between items-start mb-2">
                           <Link to={`/animal/${animal.id}`} className="font-mono font-bold text-lg tracking-tighter uppercase group-hover:underline">{animal.earTag}</Link>
                           <span className="px-1.5 py-0.5 border border-[#141414] group-hover:border-[#E4E3E0] text-[9px] font-bold uppercase">
                              {animal.healthStatus}
                           </span>
                        </div>
                        <p className="text-[10px] uppercase font-serif italic mt-1opacity-70">{animal.species} • {animal.breed || 'ND'}</p>
                     </div>
                  ))}
                  </div>
               )}
               </div>
            </div>
         </div>
      </div>

      {/* Floating Quick Actions Button */}
      <div className="fixed bottom-6 right-6 z-40 group flex flex-col items-end">
         <div className="flex flex-col gap-2 mb-2 origin-bottom scale-y-0 opacity-0 group-hover:scale-y-100 group-hover:opacity-100 transition-all duration-200">
            <button onClick={() => setQuickAction('animal')} className="px-4 py-2 bg-white border border-[#141414] shadow-[2px_2px_0px_0px_#141414] text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] whitespace-nowrap">Nuovo Capo</button>
            <button onClick={() => setQuickAction('weight')} className="px-4 py-2 bg-white border border-[#141414] shadow-[2px_2px_0px_0px_#141414] text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] whitespace-nowrap">Registra Peso</button>
            <button onClick={() => setQuickAction('feed')} className="px-4 py-2 bg-white border border-[#141414] shadow-[2px_2px_0px_0px_#141414] text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] whitespace-nowrap">Movimento Feed</button>
         </div>
         <button className="w-14 h-14 bg-[#141414] text-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-[#E4E3E0] hover:text-[#141414] transition-colors rounded-full relative z-40 focus:outline-none">
            <div className="text-2xl">+</div>
         </button>
      </div>

      {/* Quick Action Modal */}
      {quickAction !== 'none' && (
         <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
               <div className="fixed inset-0 bg-[#141414]/50 backdrop-blur-sm" onClick={() => setQuickAction('none')}></div>
               <div className="relative bg-white border border-[#141414] shadow-[8px_8px_0px_0px_#141414] w-full max-w-sm p-6">
                  <h3 className="text-xl font-bold tracking-tighter uppercase mb-4">
                     {quickAction === 'animal' && 'Registra Nuovo Capo'}
                     {quickAction === 'weight' && 'Registra Peso Rapido'}
                     {quickAction === 'feed' && 'Movimento Magazzino'}
                  </h3>
                  <form onSubmit={handleQuickAction} className="space-y-4">
                     {quickAction === 'animal' && (
                        <>
                           <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Orecchino *</label>
                              <input required name="earTag" type="text" className="w-full border border-[#141414] bg-[#E4E3E0] py-2 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]" />
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Specie *</label>
                              <input required name="species" type="text" defaultValue="Bovino" className="w-full border border-[#141414] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]" />
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data Nascita *</label>
                              <input required name="dateOfBirth" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full border border-[#141414] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]" />
                           </div>
                        </>
                     )}
                     {quickAction === 'weight' && (
                        <>
                           <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Animale *</label>
                              <select required name="animalId" className="w-full border border-[#141414] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]">
                                 {animals.map(a => <option key={a.id} value={a.id}>{a.earTag}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Peso (kg) *</label>
                              <input required name="weight" type="number" step="0.1" className="w-full border border-[#141414] bg-[#E4E3E0] py-2 px-3 text-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]" />
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data *</label>
                              <input required name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full border border-[#141414] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]" />
                           </div>
                        </>
                     )}
                     {quickAction === 'feed' && (
                        <>
                           <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Prodotto *</label>
                              <select required name="stockId" className="w-full border border-[#141414] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]">
                                 {feedStocks.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Tipo *</label>
                              <select required name="type" className="w-full border border-[#141414] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]">
                                 <option value="in">Carico (Acquisto)</option>
                                 <option value="out">Scarico (Consumo)</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Quantità *</label>
                              <input required name="amount" type="number" step="1" className="w-full border border-[#141414] bg-[#E4E3E0] py-2 px-3 text-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]" />
                           </div>
                        </>
                     )}
                     <div className="flex gap-2 pt-4">
                        <button type="submit" className="flex-1 bg-[#141414] text-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0px_0px_#141414] py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] hover:shadow-none transition-all">Salva</button>
                        <button type="button" onClick={() => setQuickAction('none')} className="bg-white border border-[#141414] py-2 px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-[#E4E3E0] transition-colors">Annulla</button>
                     </div>
                  </form>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
