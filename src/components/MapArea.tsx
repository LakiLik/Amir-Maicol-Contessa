import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from '../lib/db-mock';
import { db } from '../lib/db-mock';
import { Animal, Geozone, CustomAlert } from '../types';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MapPin, Map as MapIcon, ShieldAlert, Plus, Trash2 } from 'lucide-react';

interface MapAreaProps {
  user: User;
}

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function MapArea({ user }: MapAreaProps) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [geozones, setGeozones] = useState<Geozone[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'draw_circle'>('view');

  useEffect(() => {
    const qA = query(collection(db, 'animals'), where('userId', '==', user.id));
    const unsubA = onSnapshot(qA, (snap) => {
      setAnimals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Animal)));
    });

    const qG = query(collection(db, 'geozones'), where('userId', '==', user.id));
    const unsubG = onSnapshot(qG, (snap) => {
      setGeozones(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Geozone)));
      setLoading(false);
    });

    return () => {
      unsubA();
      unsubG();
    };
  }, [user.id]);

  const addGeozone = async (lat: number, lng: number) => {
    // Basic implementation: add a circle geozone of 500m radius
    try {
       await addDoc(collection(db, 'geozones'), {
          name: `Zona ${geozones.length + 1}`,
          type: 'circle',
          center: { lat, lng },
          radius: 100, // 100 meters
          userId: user.id,
          createdAt: Date.now()
       });
       setMode('view');
    } catch (e) {
       console.error("Geozone add error", e);
    }
  };

  const removeGeozone = async (id: string) => {
     try {
        await deleteDoc(doc(db, 'geozones', id));
     } catch (e) {
        console.error("Geozone remove error", e);
     }
  };

  const simulateScattering = async () => {
    // Center of Rome if no geozones, else use first geozone
    const center = geozones.length > 0 && geozones[0].center ? geozones[0].center : { lat: 41.9028, lng: 12.4964 };
    
    for (const animal of animals) {
       // Random offset between -0.002 and +0.002 (approx 200 meters)
       const randomLat = center.lat + (Math.random() - 0.5) * 0.004;
       const randomLng = center.lng + (Math.random() - 0.5) * 0.004;
       
       try {
          await updateDoc(doc(db, 'animals', animal.id), {
             lastLocation: { lat: randomLat, lng: randomLng }
          });
       } catch (e) {
          console.error("Failed to update GPS for", animal.id);
       }
    }
  };

  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="max-w-xl text-center border p-8 bg-[var(--card-bg)] border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)]">
          <h2 className="text-2xl font-bold uppercase tracking-tighter mb-4">Chiave Google Maps Richiesta</h2>
          <p className="text-sm font-serif italic mb-6">Per utilizzare la funzionalità mappa e geofencing è necessaria una chiave API.</p>
          <ul className="text-left text-sm space-y-2 mb-6 ml-6 list-disc">
            <li>Apri <strong>Settings</strong> (icona ⚙️ in alto a destra)</li>
            <li>Seleziona <strong>Secrets</strong></li>
            <li>Inserisci il nome <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
            <li>Incolla la tua chiave API Google Maps e premi Invio</li>
          </ul>
        </div>
      </div>
    );
  }

  // Calculate distance in meters between two lat/lng
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  // Compute total out of bounds based on current client state
  const animalsOutOfBounds = animals.filter(animal => {
     if (!animal.lastLocation) return false;
     // If there are no geozones, nobody is out of bounds
     if (geozones.length === 0) return false;
     
     // Needs to be in AT LEAST one geozone to be "safe"
     const isSafe = geozones.some(zone => {
        if (zone.type === 'circle' && zone.center && zone.radius) {
           const dist = calculateDistance(animal.lastLocation!.lat, animal.lastLocation!.lng, zone.center.lat, zone.center.lng);
           return dist <= zone.radius;
        }
        return false;
     });
     
     return !isSafe;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-end mb-4 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase mb-1 flex items-center gap-2">
            <MapIcon className="w-8 h-8" />
            Mappa Pascoli
          </h1>
          <p className="font-serif italic text-sm uppercase opacity-60">Monitoraggio GPS e Geofencing</p>
        </div>
        
        <div className="flex items-center gap-4">
           {animalsOutOfBounds.length > 0 && (
             <div className="flex items-center gap-2 border border-red-500 bg-red-50 text-red-700 px-4 py-2 font-bold uppercase tracking-widest text-xs animate-pulse">
                <ShieldAlert size={16} />
                <span>{animalsOutOfBounds.length} Animali Fuori Zona</span>
             </div>
           )}
           <button 
              onClick={simulateScattering}
              className={`text-[10px] border border-[var(--fg-color)] bg-[var(--card-bg)] px-3 py-2 font-bold uppercase tracking-widest transition-colors flex items-center gap-2 hover:bg-[var(--bg-color)]`}
           >
              Simula GPS GPS
           </button>
           <button type="button"
              onClick={() => setMode(mode === 'view' ? 'draw_circle' : 'view')}
              className={`text-xs border border-[var(--fg-color)] px-4 py-3 font-bold uppercase tracking-widest transition-colors flex items-center gap-2 shadow-[2px_2px_0px_0px_var(--fg-color)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none cursor-pointer ${mode === 'draw_circle' ? 'bg-[var(--fg-color)] text-[var(--bg-color)]' : 'bg-[var(--card-bg)] hover:bg-[var(--bg-color)]'}`}
           >
              <Plus size={14} />
              {mode === 'draw_circle' ? 'Annulla Inserimento' : 'Nuova Geo-Zona'}
           </button>
        </div>
      </div>
      
      <div className="flex-1 border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] bg-[var(--bg-color)] relative flex">
         
         <div className="w-64 bg-[var(--card-bg)] border-r border-[var(--fg-color)] flex flex-col hidden md:flex">
             <div className="p-4 border-b border-[var(--fg-color)]">
                <h3 className="font-bold uppercase tracking-widest text-xs mb-1">Geo-Zone ({geozones.length})</h3>
                <p className="text-[10px] font-sans opacity-60">Aree operative impostate</p>
             </div>
             <div className="flex-1 overflow-auto divide-y divide-[var(--fg-color)]">
                {geozones.map(zone => (
                   <div key={zone.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-color)] transition-colors group">
                      <div>
                         <div className="font-bold text-xs uppercase">{zone.name}</div>
                         {zone.type === 'circle' && <div className="text-[10px] opacity-70 font-mono mt-1">Raggio: {zone.radius}m</div>}
                      </div>
                      <button onClick={() => removeGeozone(zone.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition-opacity">
                         <Trash2 size={14} />
                      </button>
                   </div>
                ))}
                {geozones.length === 0 && (
                   <div className="p-8 text-center text-xs opacity-50 italic">Nessuna zona configurata.</div>
                )}
             </div>
         </div>

         <div className="flex-1 relative">
            <APIProvider apiKey={API_KEY} version="weekly">
               <Map
                  defaultCenter={{ lat: 41.9028, lng: 12.4964 }} // Rome defaults
                  defaultZoom={15}
                  mapId="CATTLE_TRACKER_MAP"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-full"
                  onClick={(e) => {
                     if (mode === 'draw_circle' && e.detail.latLng) {
                        addGeozone(e.detail.latLng.lat, e.detail.latLng.lng);
                     }
                  }}
                  style={mode === 'draw_circle' ? { cursor: 'crosshair' } : undefined}
               >
                  {/* Render Geozones via Deck.gl or basic markers for now since Circle requires advanced imports or Deck */}
                  {/* Given constraints, I will render basic visual markers for zones to avoid complex overlay state, or just AdvancedMarkers */}
                  {geozones.map(zone => zone.type === 'circle' && zone.center ? (
                     <AdvancedMarker key={'zone-'+zone.id} position={zone.center} zIndex={10}>
                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center pointer-events-none" style={{ width: zone.radius! * 2, height: zone.radius! * 2, minWidth: '100px', minHeight: '100px' }}>
                           <span className="text-[10px] font-bold text-green-800 bg-[var(--card-bg)]/70 px-1">{zone.name}</span>
                         </div>
                     </AdvancedMarker>
                  ) : null)}

                  {animals.filter(a => a.lastLocation).map(animal => {
                     const isOut = animalsOutOfBounds.some(a => a.id === animal.id);
                     return (
                        <AdvancedMarker key={animal.id} position={animal.lastLocation!} title={animal.earTag + (animal.name ? ` (${animal.name})` : '')} zIndex={20}>
                           <Pin background={isOut ? '#EF4444' : 'var(--fg-color)'} borderColor={isOut ? '#7F1D1D' : '#000'} glyphColor="#fff">
                              <span className="text-[10px] font-bold flex items-center justify-center w-full h-full">{animal.earTag.substring(0,3)}</span>
                           </Pin>
                        </AdvancedMarker>
                     );
                  })}
               </Map>
            </APIProvider>
            
            {mode === 'draw_circle' && (
               <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--fg-color)] text-white px-4 py-2 font-bold uppercase tracking-widest text-[10px] shadow-lg pointer-events-none z-10 animate-pulse">
                  Clicca sulla mappa per posizionare il centro della zona
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
