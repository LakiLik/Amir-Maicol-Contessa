import { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { Animal } from '../types';
import { subscribeToAnimals, addAnimal, deleteAnimal, updateAnimal } from '../lib/api';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, FileText, Plus, Search, Trash2, Edit2, Camera, Loader2, Settings2, QrCode, Upload } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import * as xlsx from 'xlsx';
import { Scanner } from '@yudiel/react-qr-scanner';

interface GridProps {
  user: User;
}


export default function AnimalGrid({ user }: GridProps) {  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);

  // PDF Config Modal
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfConfig, setPdfConfig] = useState({
     earTag: true,
     name: true,
     species: true,
     breed: true,
     dateOfBirth: true,
     healthStatus: true,
     gender: false
  });

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const earTagRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToAnimals(user.id, (data) => {
      setAnimals(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user.id]);

  const filteredAnimals = animals.filter(a => 
    a.earTag.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.name && a.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const exportCSV = () => {
    const headers = ['Orecchino', 'Nome', 'Specie', 'Razza', 'Data di Nascita', 'Stato Salute', 'Peso (kg)'];
    const rows = filteredAnimals.map(a => [
      a.earTag, a.name || '', a.species, a.breed || '', a.dateOfBirth, a.healthStatus, a.currentWeight || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bestiame.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportXLSX = () => {
    const ws = xlsx.utils.json_to_sheet(filteredAnimals.map(a => ({
        Orecchino: a.earTag,
        Nome: a.name || '',
        Specie: a.species,
        Razza: a.breed || '',
        DataNascita: a.dateOfBirth,
        Salute: a.healthStatus || '',
        Sesso: a.gender || '',
        Peso: a.currentWeight || ''
    })));
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Animali");
    xlsx.writeFile(wb, "bestiame.xlsx");
  };

  const handleImportXLSX = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json(ws);
        
        for (const row of data as any[]) {
            const animalData = {
                earTag: String(row.Orecchino || row.earTag || ''),
                name: String(row.Nome || row.name || ''),
                species: String(row.Specie || row.species || 'Bovino'),
                breed: String(row.Razza || row.breed || ''),
                dateOfBirth: String(row.DataNascita || row.dateOfBirth || new Date().toISOString().split('T')[0]),
                healthStatus: String(row.Salute || row.healthStatus || 'Sano'),
                gender: String(row.Sesso || row.gender || 'F'),
                userId: user.id,
                createdAt: Date.now()
            };
            if (animalData.earTag) {
                await addAnimal(animalData);
            }
        }
    };
    reader.readAsBinaryString(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Report Bestiame", 14, 15);

    const headConfig: string[] = [];
    if (pdfConfig.earTag) headConfig.push('Orecchino');
    if (pdfConfig.name) headConfig.push('Nome');
    if (pdfConfig.species) headConfig.push('Specie');
    if (pdfConfig.breed) headConfig.push('Razza');
    if (pdfConfig.dateOfBirth) headConfig.push('Data Nascita');
    if (pdfConfig.healthStatus) headConfig.push('Salute');
    if (pdfConfig.gender) headConfig.push('Sesso');

    const bodyData = filteredAnimals.map(a => {
      const row = [];
      if (pdfConfig.earTag) row.push(a.earTag);
      if (pdfConfig.name) row.push(a.name || '');
      if (pdfConfig.species) row.push(a.species);
      if (pdfConfig.breed) row.push(a.breed || '');
      if (pdfConfig.dateOfBirth) row.push(a.dateOfBirth);
      if (pdfConfig.healthStatus) row.push(a.healthStatus || '');
      if (pdfConfig.gender) row.push(a.gender || '');
      return row;
    });

    autoTable(doc, {
      startY: 20,
      head: [headConfig],
      body: bodyData,
      theme: 'grid',
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] }
    });
    doc.save("bestiame.pdf");
    setIsPdfModalOpen(false);
  };

  const handleScanEarTag = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
       const worker = await createWorker('eng');
       const ret = await worker.recognize(file);
       // Simple OCR extraction: remove all spaces, keep alphanumeric 
       // Often ear tags have letters and numbers
       const rawText = ret.data.text.trim();
       const possibleTag = rawText.replace(/[^A-Za-z0-9]/g, '').substring(0, 14).toUpperCase();
       if (earTagRef.current && possibleTag) {
          earTagRef.current.value = possibleTag;
       }
       await worker.terminate();
    } catch (err) {
       console.error("Errore OCR:", err);
    } finally {
       setIsScanning(false);
    }
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      earTag: formData.get('earTag') as string,
      name: formData.get('name') as string,
      species: formData.get('species') as string,
      gender: formData.get('gender') as string,
      dateOfBirth: formData.get('dateOfBirth') as string,
      breed: formData.get('breed') as string,
      healthStatus: formData.get('healthStatus') as string,
      photoUrl: formData.get('photoUrl') as string,
      motherId: formData.get('motherId') as string || undefined,
      fatherId: formData.get('fatherId') as string || undefined,
      userId: user.id,
    };

    if (editingAnimal) {
      await updateAnimal(editingAnimal.id, data, user.id);
    } else {
      await addAnimal(data);
    }
    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAnimal(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter uppercase mb-1">Archivio Esemplari</h1>
          <p className="font-serif italic text-[11px] uppercase opacity-60">Visualizzazione in formato tabella</p>
        </div>
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <input type="file" accept=".xlsx, .xls, .csv" hidden ref={fileInputRef} onChange={handleImportXLSX} />
          <button onClick={() => fileInputRef.current?.click()} className="text-xs border border-[var(--fg-color)] bg-[var(--card-bg)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] flex items-center">
            <Upload size={14} className="mr-1" /> Import XLSX/CSV
          </button>
          <button onClick={exportXLSX} className="text-xs border border-[var(--fg-color)] bg-[var(--card-bg)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
            Exp XLSX
          </button>
          <button onClick={exportCSV} className="text-xs border border-[var(--fg-color)] bg-[var(--card-bg)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
            Exp CSV
          </button>
          <button onClick={() => setIsPdfModalOpen(true)} className="text-xs border border-[var(--fg-color)] bg-[var(--card-bg)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
            Exp PDF
          </button>
          <button type="button" onClick={() => setIsModalOpen(true)} className="flex items-center text-xs border border-[var(--fg-color)] bg-[var(--fg-color)] text-[var(--bg-color)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--bg-color)] hover:text-[var(--fg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer">
            <Plus size={14} className="mr-1" />
            Nuovo Capo
          </button>
        </div>
      </div>

      <div className="relative max-w-sm mb-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 opacity-50" />
        </div>
        <input
          type="text"
          className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2.5 pl-10 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] shadow-[4px_4px_0px_0px_var(--fg-color)]"
          placeholder="CERCA ORECCHINO/NOME..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="border border-[var(--fg-color)] bg-transparent overflow-hidden overflow-x-auto shadow-[4px_4px_0px_0px_var(--fg-color)]">
        <table className="min-w-full divide-y-2 divide-[var(--fg-color)]">
          <thead className="bg-[#D8D7D3]">
            <tr>
              <th scope="col" className="px-6 py-3 text-left font-serif italic text-[11px] uppercase tracking-wider opacity-70">Orecchino / Nome</th>
              <th scope="col" className="px-6 py-3 text-left font-serif italic text-[11px] uppercase tracking-wider opacity-70">Specie & Razza</th>
              <th scope="col" className="px-6 py-3 text-left font-serif italic text-[11px] uppercase tracking-wider opacity-70">Salute</th>
              <th scope="col" className="px-6 py-3 text-left font-serif italic text-[11px] uppercase tracking-wider opacity-70">Data Nascita</th>
              <th scope="col" className="relative px-6 py-3 text-right font-serif italic text-[11px] uppercase tracking-wider opacity-70">Azioni</th>
            </tr>
          </thead>
          <tbody className="bg-transparent divide-y divide-[var(--fg-color)]">
            {loading ? (
               <tr><td colSpan={5} className="px-6 py-8 text-center text-[10px] font-mono uppercase tracking-widest border-b border-[var(--fg-color)]">Lettura archivi...</td></tr>
            ) : filteredAnimals.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-xs font-mono opacity-50 border-b border-[var(--fg-color)]">Nessun record presente in DB.</td></tr>
            ) : (
              filteredAnimals.map((animal) => (
                <tr key={animal.id} className="hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] group cursor-pointer transition-colors bg-[var(--card-bg)]">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {animal.photoUrl ? (
                         <img src={animal.photoUrl} alt="" className="w-10 h-10 border border-[var(--fg-color)] object-cover grayscale group-hover:grayscale-0 transition-all" />
                      ) : (
                         <div className="w-10 h-10 bg-[var(--bg-color)] border border-[var(--fg-color)] flex items-center justify-center font-mono text-xs text-[var(--fg-color)] font-bold group-hover:bg-[var(--card-bg)] transition-colors">
                           {animal.species?.[0]?.toUpperCase() || '-'}
                         </div>
                      )}
                      <div className="ml-4">
                        <div className="font-mono text-sm font-bold">{animal.earTag}</div>
                        <div className="text-[10px] uppercase opacity-70">{animal.name || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-[11px] font-bold uppercase tracking-wider border border-transparent group-hover:border-[var(--bg-color)]/20 inline-block px-1">{animal.species}</div>
                    <div className="text-[10px] font-serif italic opacity-60 mt-1">{animal.breed || 'Razza ND'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 border border-[var(--fg-color)] text-[9px] font-bold uppercase
                      ${animal.healthStatus?.toLowerCase() === 'sano' || animal.healthStatus?.toLowerCase() === 'healthy' 
                        ? 'bg-green-200 text-[var(--fg-color)] group-hover:bg-green-600' 
                        : 'bg-red-200 text-[var(--fg-color)] group-hover:bg-red-600'
                      } transition-colors
                    `}>
                      {animal.healthStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono group-hover:text-white">
                    {animal.dateOfBirth.split('-').reverse().join('/')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-[10px] uppercase font-bold tracking-widest gap-2 flex justify-end">
                    <Link to={`/animal/${animal.id}`} className="border border-[var(--fg-color)] text-[var(--fg-color)] bg-[var(--card-bg)] group-hover:bg-transparent group-hover:border-[var(--bg-color)] group-hover:text-[var(--bg-color)] px-3 py-1.5 transition-colors">Dettagli</Link>
                    <button onClick={() => { setEditingAnimal(animal); setIsModalOpen(true); }} className="border border-[var(--fg-color)] text-[var(--fg-color)] bg-[var(--card-bg)] group-hover:bg-transparent group-hover:border-[var(--bg-color)] group-hover:text-[var(--bg-color)] px-3 py-1.5 transition-colors">Modifica</button>
                    <button onClick={() => confirm('Sei sicuro?') && deleteAnimal(animal.id)} className="border border-[var(--fg-color)] text-[var(--fg-color)] bg-red-200 group-hover:bg-red-600 group-hover:text-white group-hover:border-transparent px-3 py-1.5 transition-colors">Elimina</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 transition-opacity bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={closeModal}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <form onSubmit={handleSave}>
                <div className="p-8">
                  <h3 className="text-2xl font-bold tracking-tighter uppercase mb-2">
                    {editingAnimal ? 'Edita Dati Capo' : 'Registra Nuovo Capo'}
                  </h3>
                  <p className="font-serif italic text-[11px] uppercase opacity-60 mb-6 border-b border-[var(--fg-color)] pb-4">Inserimento manuale database</p>
                  
                  <div className="grid grid-cols-1 gap-y-5 sm:grid-cols-2 sm:gap-x-4">
                    <div className="col-span-2 sm:col-span-1">
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-[10px] font-bold uppercase tracking-widest opacity-70">Orecchino *</label>
                        <div className="flex items-center space-x-1">
                           <button type="button" onClick={() => setIsQRScannerOpen(true)} className="text-[9px] flex items-center gap-1 font-bold uppercase border border-[var(--fg-color)] px-2 py-0.5 hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors">
                              <QrCode size={10} /> Scan QR
                           </button>
                           <div className="relative">
                              <input type="file" accept="image/*" capture="environment" onChange={handleScanEarTag} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                              <button type="button" disabled={isScanning} className="text-[9px] flex items-center gap-1 font-bold uppercase border border-[var(--fg-color)] px-2 py-0.5 hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors disabled:opacity-50">
                                 {isScanning ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />} OCR Foto
                              </button>
                           </div>
                        </div>
                      </div>
                      <input required ref={earTagRef} type="text" name="earTag" defaultValue={editingAnimal?.earTag} className="block w-full border border-[var(--fg-color)] bg-[var(--bg-color)] py-2 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Nome</label>
                      <input type="text" name="name" defaultValue={editingAnimal?.name} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Specie *</label>
                      <select required name="species" defaultValue={editingAnimal?.species || 'mucca'} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="mucca">Mucca</option>
                        <option value="toro">Toro</option>
                        <option value="vitello">Vitello/a</option>
                        <option value="altro">Altro</option>
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Sesso</label>
                      <select name="gender" defaultValue={editingAnimal?.gender || 'F'} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="F">Femmina</option>
                        <option value="M">Maschio</option>
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data di Nascita *</label>
                      <input required type="date" name="dateOfBirth" defaultValue={editingAnimal?.dateOfBirth} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Stato Salute *</label>
                      <select required name="healthStatus" defaultValue={editingAnimal?.healthStatus || 'Sano'} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="Sano">Sano</option>
                        <option value="Malato">Malato</option>
                        <option value="In Osservazione">In Osservazione</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Razza</label>
                      <input type="text" name="breed" defaultValue={editingAnimal?.breed} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Madre (Opzionale)</label>
                      <select name="motherId" defaultValue={editingAnimal?.motherId || ''} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="">-- Seleziona --</option>
                        {animals.filter(a => a.gender === 'F' && a.id !== editingAnimal?.id).map(a => (
                          <option key={a.id} value={a.id}>{a.earTag} {a.name ? `(${a.name})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Padre (Opzionale)</label>
                      <select name="fatherId" defaultValue={editingAnimal?.fatherId || ''} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="">-- Seleziona --</option>
                        {animals.filter(a => a.gender === 'M' && a.id !== editingAnimal?.id).map(a => (
                          <option key={a.id} value={a.id}>{a.earTag} {a.name ? `(${a.name})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">URL Foto (CDN)</label>
                      <input type="url" name="photoUrl" defaultValue={editingAnimal?.photoUrl} placeholder="https://..." className="block w-full border border-[var(--fg-color)] bg-[var(--bg-color)]/30 py-2 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                  </div>
                </div>
                <div className="bg-[var(--bg-color)] px-8 py-4 sm:flex sm:flex-row-reverse border-t border-[var(--fg-color)] gap-3">
                  <button type="submit" className="w-full inline-flex justify-center border border-transparent bg-[var(--fg-color)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--card-bg)] hover:border-[var(--fg-color)] hover:text-[var(--fg-color)] focus:outline-none focus:ring-0 active:shadow-none active:translate-y-[2px] active:translate-x-[2px] sm:w-auto">
                    {editingAnimal ? 'Applica Modifiche' : 'Registra Form'}
                  </button>
                  <button type="button" onClick={closeModal} className="mt-3 w-full inline-flex justify-center border border-[var(--fg-color)] bg-[var(--card-bg)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--bg-color)] focus:outline-none focus:ring-0 active:shadow-none active:translate-y-[2px] active:translate-x-[2px] sm:mt-0 sm:w-auto">
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Config Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 transition-opacity bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setIsPdfModalOpen(false)}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full p-8">
               <h3 className="text-2xl font-bold tracking-tighter uppercase mb-2 flex items-center gap-2">
                 <Settings2 className="w-6 h-6" /> Export PDF
               </h3>
               <p className="font-serif italic text-[11px] uppercase opacity-60 mb-6 border-b border-[var(--fg-color)] pb-4">Seleziona i campi da esportare</p>
               
               <div className="space-y-4 font-mono text-sm uppercase">
                  {Object.entries(pdfConfig).map(([key, value]) => (
                     <label key={key} className="flex items-center space-x-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center">
                           <input type="checkbox" className="sr-only" checked={value} onChange={() => setPdfConfig(prev => ({ ...prev, [key]: !prev[key as keyof typeof pdfConfig] }))} />
                           <div className={`w-5 h-5 flex items-center justify-center border transition-colors ${value ? 'bg-[var(--fg-color)] border-[var(--fg-color)]' : 'bg-transparent border-[var(--fg-color)] group-hover:bg-[var(--fg-color)]/10'}`}>
                              {value && <div className="w-2.5 h-2.5 bg-[var(--bg-color)]"></div>}
                           </div>
                        </div>
                        <span className="font-bold tracking-widest">{key === 'earTag' ? 'Orecchino' : key === 'dateOfBirth' ? 'Data Nascita' : key === 'healthStatus' ? 'Salute' : key}</span>
                     </label>
                  ))}
               </div>

               <div className="mt-8 flex gap-3">
                  <button onClick={exportPDF} className="flex-1 w-full inline-flex justify-center border border-transparent bg-[var(--fg-color)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--card-bg)] hover:border-[var(--fg-color)] hover:text-[var(--fg-color)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">
                     Genera Report
                  </button>
                  <button onClick={() => setIsPdfModalOpen(false)} className="w-auto inline-flex justify-center border border-[var(--fg-color)] bg-[var(--card-bg)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] hover:bg-[var(--bg-color)] transition-colors">
                     Chiudi
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {isQRScannerOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setIsQRScannerOpen(false)}></div>
            <div className="relative bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] w-full max-w-sm p-4">
               <h3 className="text-xl font-bold tracking-tighter uppercase mb-4">Scanner QR</h3>
               <div className="w-full aspect-square bg-[var(--bg-color)] border border-[var(--fg-color)] overflow-hidden">
                  <Scanner onScan={(result) => {
                     if (result && result.length > 0 && earTagRef.current) {
                        earTagRef.current.value = result[0].rawValue;
                        setIsQRScannerOpen(false);
                     }
                  }} />
               </div>
               <button type="button" onClick={() => setIsQRScannerOpen(false)} className="mt-4 w-full border border-[var(--fg-color)] bg-[var(--card-bg)] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] hover:bg-[var(--bg-color)] transition-colors">
                  Chiudi QR Scanner
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
