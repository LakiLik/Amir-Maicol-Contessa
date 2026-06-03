import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Database, Download, RefreshCw, Server, FileJson, Search, UploadCloud, ClipboardList } from 'lucide-react';

interface DatabaseExplorerProps {
  user: User;
}

const COLLECTIONS = [
  'animals',
  'weightRecords',
  'feedStocks',
  'feedTransactions',
  'alerts',
  'milkRecords',
  'auditLogs'
];

export default function DatabaseExplorer({ user }: DatabaseExplorerProps) {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeCollection, setActiveCollection] = useState<string>(COLLECTIONS[0]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const [activeTab, setActiveTab] = useState<'explorer' | 'backup' | 'audit'>('explorer');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  const logAction = async (action: string, details: string) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action,
        details,
        userId: user.uid,
        createdAt: Date.now()
      });
      if (activeTab === 'audit') {
         fetchData();
      }
    } catch (e) {
      console.error('Failed to log action', e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const dbData: Record<string, any[]> = {};
    
    for (const colName of COLLECTIONS) {
      try {
        const q = query(collection(db, colName), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        dbData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error(`Error fetching ${colName}`, err);
        dbData[colName] = [];
      }
    }
    
    setData(dbData);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user.uid]);

  const exportAllJSON = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `database_export_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    logAction('EXPORT_ALL', `Exported full database to JSON`);
  };

  const exportCollectionJSON = () => {
    const dataStr = JSON.stringify(data[activeCollection] || [], null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${activeCollection}_export_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    logAction('EXPORT_COLLECTION', `Exported collection ${activeCollection}`);
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        for (const col of Object.keys(json)) {
            if (COLLECTIONS.includes(col)) {
                const records = json[col];
                for (const row of records) {
                    const rowId = row.id;
                    const { id, ...rowData } = row;
                    if (rowId) {
                       await setDoc(doc(db, col, rowId), rowData);
                    } else {
                       await addDoc(collection(db, col), rowData);
                    }
                }
            }
        }
        await logAction('RESTORE_DB', `Restored database from ${file.name}`);
        alert('Ripristino completato con successo!');
        fetchData();
      } catch (err) {
        console.error('Restore failed', err);
        alert('Errore nel ripristino del JSON.');
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  const activeData = data[activeCollection] || [];
  const filteredData = activeData.filter(item => 
      JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
  );
  const auditLogs = (data['auditLogs'] || []).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-[#141414] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase mb-1 flex items-center gap-2">
            <Server className="w-8 h-8" />
            Database Explorer
          </h1>
          <p className="font-serif italic text-sm uppercase opacity-60">Pannello di controllo dati grezzi (Admin)</p>
        </div>
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
           <button onClick={fetchData} disabled={loading} className="text-xs border border-[#141414] bg-white px-4 py-3 font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors shadow-[2px_2px_0px_0px_#141414] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] disabled:opacity-50 flex items-center gap-2">
             <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Aggiorna
           </button>
        </div>
      </div>

      <div className="flex space-x-4 border-b border-[#141414] pb-2">
         <button onClick={() => setActiveTab('explorer')} className={`text-[11px] font-bold uppercase tracking-widest px-2 py-1 ${activeTab === 'explorer' ? 'border-b-2 border-[#141414]' : 'opacity-60'}`}>Data Explorer</button>
         <button onClick={() => setActiveTab('backup')} className={`text-[11px] font-bold uppercase tracking-widest px-2 py-1 ${activeTab === 'backup' ? 'border-b-2 border-[#141414]' : 'opacity-60'}`}>Backup & Restore</button>
         <button onClick={() => setActiveTab('audit')} className={`text-[11px] font-bold uppercase tracking-widest px-2 py-1 ${activeTab === 'audit' ? 'border-b-2 border-[#141414]' : 'opacity-60'}`}>Audit Logs</button>
      </div>

      {activeTab === 'explorer' && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {/* Sidebar collections */}
         <div className="md:col-span-1 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2 mb-4">Collezioni</h2>
            {COLLECTIONS.map(col => (
               <button
                  key={col}
                  onClick={() => setActiveCollection(col)}
                  className={`w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest border border-[#141414] transition-all ${activeCollection === col ? 'bg-[#141414] text-[#E4E3E0] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]' : 'bg-white hover:bg-[#E4E3E0] shadow-[2px_2px_0px_0px_#141414]'}`}
               >
                  <div className="flex justify-between items-center">
                     <span className="flex items-center gap-2"><Database size={12} /> {col}</span>
                     {!loading && <span className="opacity-50">[{data[col]?.length || 0}]</span>}
                  </div>
               </button>
            ))}

            {!loading && (
               <div className="mt-8 p-4 border border-[#141414] bg-white shadow-[4px_4px_0px_0px_#141414]">
                  <p className="text-[9px] font-mono uppercase tracking-widest font-bold opacity-70 mb-1">Status Storage</p>
                  <p className="text-[10px] font-mono">OK / LIVE</p>
                  <p className="text-[9px] font-mono uppercase tracking-widest font-bold opacity-70 mt-4 mb-1">Ultimo Aggiornamento</p>
                  <p className="text-[10px] font-mono">{lastUpdated.toLocaleTimeString()}</p>
               </div>
            )}
         </div>

         {/* Content View */}
         <div className="md:col-span-3">
            <div className="flex justify-between items-end mb-4 flex-wrap gap-2">
               <div>
                  <h3 className="text-xl font-bold uppercase tracking-tighter">Collezione: {activeCollection}</h3>
                  <p className="text-[10px] font-sans opacity-60">Visualizzazione dati grezzi</p>
               </div>
               <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={14} className="text-[#141414] opacity-50" />
                     </div>
                     <input
                        type="text"
                        placeholder="Cerca in questi record..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border border-[#141414] bg-white py-2 pl-9 pr-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
                     />
                  </div>
                  <button onClick={exportCollectionJSON} disabled={loading || filteredData.length === 0} className="text-[10px] font-bold uppercase tracking-widest border border-[#141414] bg-white px-3 py-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap">
                     <FileJson size={12} /> Export
                  </button>
               </div>
            </div>

            <div className="border border-[#141414] bg-[#141414] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] p-2">
               <div className="bg-[#1E1E1E] w-full min-h-[500px] max-h-[700px] overflow-auto border border-[#333]">
                  {loading ? (
                     <div className="p-8 text-[#A0A0A0] font-mono text-xs animate-pulse">Caricamento in corso...</div>
                  ) : filteredData.length === 0 ? (
                     <div className="p-8 text-[#A0A0A0] font-mono text-xs">nessun record trovato in /{activeCollection}.</div>
                  ) : (
                     <pre className="p-4 text-[#D4D4D4] font-mono text-[10px] leading-relaxed">
                        {JSON.stringify(filteredData, null, 2)}
                     </pre>
                  )}
               </div>
            </div>
         </div>
      </div>
      )}

      {activeTab === 'backup' && (
        <div className="grid md:grid-cols-2 gap-8">
           <div className="border border-[#141414] bg-white p-8 shadow-[4px_4px_0px_0px_#141414]">
              <div className="w-12 h-12 bg-[#141414] text-[#E4E3E0] flex items-center justify-center mb-6">
                <Download size={24} />
              </div>
              <h3 className="font-bold uppercase tracking-tighter text-2xl mb-2">Export Data</h3>
              <p className="text-sm font-serif italic mb-8 opacity-70">Scarica un backup completo o parziale del database in formato JSON per conservazione offline.</p>
              <button onClick={exportAllJSON} disabled={loading} className="w-full justify-center text-xs border border-[#141414] bg-[#141414] text-[#E4E3E0] px-4 py-4 font-bold uppercase tracking-widest hover:bg-white hover:text-[#141414] transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-y-[4px] hover:translate-x-[4px] disabled:opacity-50 flex items-center gap-2">
                 <FileJson size={16} /> Scarica Backup ({Object.keys(data).reduce((acc, c) => acc + (data[c]?.length || 0), 0)} records)
              </button>
           </div>
           
           <div className="border border-[#141414] bg-white p-8 shadow-[4px_4px_0px_0px_#141414]">
              <div className="w-12 h-12 border-2 border-[#141414] text-[#141414] flex items-center justify-center mb-6">
                <UploadCloud size={24} />
              </div>
              <h3 className="font-bold uppercase tracking-tighter text-2xl mb-2">Restore Data</h3>
              <p className="text-sm font-serif italic mb-6 text-red-600">Attenzione: Il ripristino sovrascriverà i dati esistenti se gli ID coincidono e ne aggiungerà di nuovi in modo incrementale.</p>
              <label className={`w-full justify-center text-xs border border-[#141414] bg-white text-[#141414] px-4 py-4 font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all shadow-[4px_4px_0px_0px_#141414] hover:shadow-none hover:translate-y-[4px] hover:translate-x-[4px] disabled:opacity-50 flex items-center gap-2 cursor-pointer ${isRestoring ? 'opacity-50 pointer-events-none' : ''}`}>
                 <RefreshCw size={16} className={isRestoring ? 'animate-spin' : ''} /> {isRestoring ? 'Ripristino in corso...' : 'Carica File JSON'}
                 <input type="file" accept=".json" className="hidden" onChange={handleRestore} disabled={isRestoring} />
              </label>
           </div>
        </div>
      )}

      {activeTab === 'audit' && (
         <div className="border border-[#141414] bg-white shadow-[4px_4px_0px_0px_#141414] overflow-hidden">
            {auditLogs.length === 0 ? (
               <div className="p-12 text-center flex flex-col items-center">
                  <ClipboardList className="w-12 h-12 opacity-20 mb-4" />
                  <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Nessun evento amministrativo registrato.</span>
               </div>
            ) : (
               <div className="divide-y divide-[#141414]">
                 {auditLogs.map(log => (
                    <div key={log.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-[#E4E3E0] transition-colors">
                       <div>
                          <div className="font-bold font-mono text-[11px] uppercase">{log.action}</div>
                          <div className="text-[11px] font-serif italic opacity-70 mt-1">{log.details}</div>
                       </div>
                       <div className="text-[9px] font-mono uppercase tracking-widest opacity-50 mt-2 md:mt-0 bg-white border border-[#141414] px-2 py-1">
                          {new Date(log.createdAt).toLocaleString()}
                       </div>
                    </div>
                 ))}
               </div>
            )}
         </div>
      )}
    </div>
  );
}
