import { useState, useEffect } from 'react';
import { db } from '../lib/db-mock';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from '../lib/db-mock';
import { Animal } from '../types';
import { Link } from 'react-router-dom';
import { Search, Plus, X } from 'lucide-react';

interface FamilyTreeProps {
  currentAnimalId: string;
  userId: string;
}

export default function FamilyTree({ currentAnimalId, userId }: FamilyTreeProps) {
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [mother, setMother] = useState<Animal | null>(null);
  const [father, setFather] = useState<Animal | null>(null);
  const [children, setChildren] = useState<Animal[]>([]);
  
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [isLinking, setIsLinking] = useState<'mother' | 'father' | 'child' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Fetch all animals for the search/link modal
    const q = query(collection(db, 'animals'), where('userId', '==', userId));
    const unsub = onSnapshot(q, (snap) => {
       const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Animal));
       setAllAnimals(docs);
       
       const curr = docs.find(a => a.id === currentAnimalId);
       if (curr) {
          setAnimal(curr);
          setMother(docs.find(a => a.id === curr.motherId) || null);
          setFather(docs.find(a => a.id === curr.fatherId) || null);
          setChildren(docs.filter(a => a.motherId === currentAnimalId || a.fatherId === currentAnimalId));
       }
    });
    return unsub;
  }, [currentAnimalId, userId]);

  const handleLink = async (targetAnimalId: string) => {
    if (!animal) return;
    try {
       if (isLinking === 'mother') {
         await updateDoc(doc(db, 'animals', animal.id), { motherId: targetAnimalId });
       } else if (isLinking === 'father') {
         await updateDoc(doc(db, 'animals', animal.id), { fatherId: targetAnimalId });
       } else if (isLinking === 'child') {
         const isFemale = animal.gender === 'F';
         await updateDoc(doc(db, 'animals', targetAnimalId), isFemale ? { motherId: animal.id } : { fatherId: animal.id });
       }
       setIsLinking(null);
       setSearchQuery('');
    } catch(err) {
       console.error("Link error:", err);
    }
  };

  const unlinkParent = async (parentType: 'mother' | 'father') => {
    if (!animal) return;
    await updateDoc(doc(db, 'animals', animal.id), parentType === 'mother' ? { motherId: null } : { fatherId: null });
  };
  
  const unlinkChild = async (childId: string) => {
     if (!animal) return;
     const isFemale = animal.gender === 'F';
     await updateDoc(doc(db, 'animals', childId), isFemale ? { motherId: null } : { fatherId: null });
  };

  if (!animal) return <div>Loading...</div>;

  const filteredAnimals = allAnimals.filter(a => 
      a.id !== currentAnimalId && 
      (a.earTag.toLowerCase().includes(searchQuery.toLowerCase()) || 
       (a.name && a.name.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_#141414] relative">
      <div className="flex flex-col items-center">
        {/* Parents Row */}
        <div className="flex justify-center gap-4 md:gap-16 mb-12 relative w-full">
          <div className="text-center flex-1 max-w-[200px]">
            <h3 className="text-[10px] font-bold text-[#141414] uppercase tracking-widest mb-3 opacity-70">Madre</h3>
            {mother ? (
              <div className="relative group">
                 <Link to={`/animal/${mother.id}`} className="block p-4 border border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors shadow-[2px_2px_0px_0px_#141414] hover:shadow-none">
                   <p className="font-mono font-bold text-lg">{mother.earTag}</p>
                   <p className="text-[10px] uppercase font-serif italic opacity-70 mt-1">{mother.name || '-'}</p>
                 </Link>
                 <button onClick={() => unlinkParent('mother')} className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                 </button>
              </div>
            ) : (
               <button onClick={() => setIsLinking('mother')} className="w-full p-4 flex flex-col items-center justify-center border border-[#141414] border-dashed text-[#141414]/60 hover:bg-[#141414] hover:text-[#E4E3E0] hover:border-solid transition-colors gap-2">
                  <Plus size={20} />
                  <span className="font-mono text-xs uppercase font-bold tracking-widest">Aggiungi</span>
               </button>
            )}
          </div>
          
          <div className="text-center flex-1 max-w-[200px]">
             <h3 className="text-[10px] font-bold text-[#141414] uppercase tracking-widest mb-3 opacity-70">Padre</h3>
             {father ? (
                <div className="relative group">
                   <Link to={`/animal/${father.id}`} className="block p-4 border border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors shadow-[2px_2px_0px_0px_#141414] hover:shadow-none">
                     <p className="font-mono font-bold text-lg">{father.earTag}</p>
                     <p className="text-[10px] uppercase font-serif italic opacity-70 mt-1">{father.name || '-'}</p>
                   </Link>
                   <button onClick={() => unlinkParent('father')} className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} />
                   </button>
                </div>
              ) : (
                 <button onClick={() => setIsLinking('father')} className="w-full p-4 flex flex-col items-center justify-center border border-[#141414] border-dashed text-[#141414]/60 hover:bg-[#141414] hover:text-[#E4E3E0] hover:border-solid transition-colors gap-2">
                    <Plus size={20} />
                    <span className="font-mono text-xs uppercase font-bold tracking-widest">Aggiungi</span>
                 </button>
              )}
          </div>
        </div>

        {/* Current Animal */}
        <div className="relative mb-12 pt-8 border-t border-[#141414] w-1/2 flex justify-center">
          <div className="absolute top-0 left-1/2 w-px h-8 bg-[#141414]"></div>
          <div className="text-center z-10 w-full max-w-[240px]">
            <div className="block p-5 border border-red-600 bg-red-600 text-white shadow-[4px_4px_0px_0px_rgba(220,38,38,0.3)] rounded-sm relative">
               <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Target</p>
               <p className="font-mono font-bold text-2xl tracking-tighter">{animal.earTag}</p>
            </div>
          </div>
        </div>

        {/* Children */}
        <div className="relative pt-12 border-t border-[#141414] w-full max-w-4xl flex flex-col items-center">
          <div className="absolute top-0 left-1/2 w-px h-12 bg-[#141414]"></div>
          <h3 className="text-[10px] font-bold text-[#141414] uppercase tracking-widest mb-8 absolute -top-10 left-1/2 -ml-6 bg-white px-3 py-1 border border-[#141414]">Generazione F1</h3>
          
          <div className="flex flex-wrap justify-center gap-6 w-full px-4">
             {children.map(child => (
                 <div key={child.id} className="relative group min-w-[140px]">
                   <Link to={`/animal/${child.id}`} className="block p-4 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors shadow-[2px_2px_0px_0px_#141414] hover:shadow-none">
                     <p className="font-mono font-bold text-lg text-center">{child.earTag}</p>
                     <p className="text-[10px] uppercase font-serif italic text-center opacity-70 mt-1">{child.name || '-'}</p>
                   </Link>
                   <button onClick={() => unlinkChild(child.id)} className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <X size={12} />
                   </button>
                 </div>
             ))}
             <button onClick={() => setIsLinking('child')} className="block min-w-[140px] p-4 flex flex-col items-center justify-center border border-[#141414] border-dashed text-[#141414]/60 hover:bg-[#141414] hover:text-[#E4E3E0] hover:border-solid transition-colors gap-2">
                <Plus size={20} />
                <span className="font-mono text-xs uppercase font-bold tracking-widest">Aggiungi</span>
             </button>
          </div>
        </div>
      </div>

      {/* Link Modal */}
      {isLinking && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#141414]/50 backdrop-blur-sm" onClick={() => { setIsLinking(null); setSearchQuery(''); }}></div>
            <div className="bg-white border border-[#141414] shadow-[8px_8px_0px_0px_#141414] p-6 max-w-lg w-full relative z-10 max-h-[80vh] flex flex-col">
               <h3 className="text-xl font-bold uppercase tracking-tighter mb-1">
                  Collega {isLinking === 'mother' ? 'Madre' : isLinking === 'father' ? 'Padre' : 'Figlio'}
               </h3>
               <p className="text-[10px] font-mono italic opacity-60 uppercase mb-4">Cerca nell'archivio</p>
               
               <div className="relative mb-6">
                  <Search className="absolute left-3 top-3 opacity-50" size={16} />
                  <input 
                     autoFocus
                     type="text" 
                     placeholder="Cerca per orecchino o nome..." 
                     className="w-full border border-[#141414] py-2 pl-10 pr-4 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]"
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                  />
               </div>

               <div className="overflow-y-auto flex-1 border border-[#141414] min-h-[200px]">
                 {filteredAnimals.length === 0 ? (
                    <div className="p-8 text-center text-[10px] font-mono uppercase opacity-50">Nessun animale trovato</div>
                 ) : (
                    <ul className="divide-y divide-[#141414]">
                      {filteredAnimals.map(a => (
                         <li key={a.id}>
                            <button onClick={() => handleLink(a.id)} className="w-full flex items-center justify-between p-3 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors text-left group">
                               <div>
                                  <p className="font-mono font-bold">{a.earTag}</p>
                                  <p className="text-[10px] uppercase font-serif opacity-70">{a.name} | {a.gender}</p>
                               </div>
                               <Plus size={16} className="opacity-0 group-hover:opacity-100" />
                            </button>
                         </li>
                      ))}
                    </ul>
                 )}
               </div>
               
               <button onClick={() => { setIsLinking(null); setSearchQuery(''); }} className="mt-6 border border-[#141414] py-2 uppercase text-[10px] font-bold tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                 Annulla
               </button>
            </div>
         </div>
      )}
    </div>
  );
}
