import { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { Animal } from '../types';
import { subscribeToAnimals, addAnimal, deleteAnimal, updateAnimal, getTreatmentsForAnimal, getWeightsForAnimal } from '../lib/api';
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
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (evt) => {
              if (evt.target?.result) {
                 setUploadedPhotos(prev => [...prev, evt.target!.result as string]);
              }
          };
          reader.readAsDataURL(file as Blob);
      });
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Export Config Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf'|'xlsx'|'csv'>('pdf');
  const [exportProgress, setExportProgress] = useState('');
  const [exportFilters, setExportFilters] = useState({
     dateRange: { start: '', end: '' },
     breed: '',
     healthStatus: ''
  });
  const [exportConfig, setExportConfig] = useState({
     earTag: true,
     name: true,
     species: true,
     breed: true,
     gender: true,
     dateOfBirth: true,
     entryDate: true,
     origin: true,
     exitDate: true,
     destination: true,
     mod4: true,
     healthStatus: true,
     motherId: false,
     fatherId: false,
     documentUrl: false,
     treatments: true,
     weights: true,
     offspring: true,
     photos: false,
  });

  const checkAllExport = (val: boolean) => {
     setExportConfig({
       earTag: val, name: val, species: val, breed: val, gender: val,
       dateOfBirth: val, entryDate: val, origin: val, exitDate: val,
       destination: val, mod4: val, healthStatus: val, motherId: val, fatherId: val, documentUrl: val,
       treatments: val, weights: val, offspring: val, photos: val
     });
  };

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [animalToDelete, setAnimalToDelete] = useState<string | null>(null);
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

  const executeExport = async () => {
    setExportProgress('Generazione in corso...');
    try {
      const headers: string[] = [];
      if (exportConfig.earTag) headers.push('Orecchino');
      if (exportConfig.name) headers.push('Nome');
      if (exportConfig.species) headers.push('Specie');
      if (exportConfig.breed) headers.push('Razza');
      if (exportConfig.gender) headers.push('Sesso');
      if (exportConfig.dateOfBirth) headers.push('Data Nascita');
      if (exportConfig.entryDate) headers.push('Data Ingresso');
      if (exportConfig.origin) headers.push('Provenienza');
      if (exportConfig.exitDate) headers.push('Data Uscita');
      if (exportConfig.destination) headers.push('Destinazione');
      if (exportConfig.mod4) headers.push('Mod 4');
      if (exportConfig.healthStatus) headers.push('Salute');
      if (exportConfig.motherId) headers.push('Madre');
      if (exportConfig.fatherId) headers.push('Padre');
      if (exportConfig.documentUrl) headers.push('Documenti');
      if (exportConfig.treatments) headers.push('Trattamenti (Storico)');
      if (exportConfig.weights) headers.push('Pesi (Storico)');
      if (exportConfig.offspring) headers.push('Prole');
      if (exportConfig.photos) headers.push('Foto Base64');

      const exportAnimals = filteredAnimals.filter(a => {
          let match = true;
          if (exportFilters.breed && (a.breed || '').toLowerCase() !== exportFilters.breed.toLowerCase()) match = false;
          if (exportFilters.healthStatus && (a.healthStatus || '').toLowerCase() !== exportFilters.healthStatus.toLowerCase()) match = false;
          if (exportFilters.dateRange.start && (a.dateOfBirth || '') < exportFilters.dateRange.start) match = false;
          if (exportFilters.dateRange.end && (a.dateOfBirth || '') > exportFilters.dateRange.end) match = false;
          return match;
      });

      const rows: any[] = [];
      for (const a of exportAnimals) {
        const row: any = {};
        if (exportConfig.earTag) row['Orecchino'] = a.earTag;
        if (exportConfig.name) row['Nome'] = a.name || '';
        if (exportConfig.species) row['Specie'] = a.species;
        if (exportConfig.breed) row['Razza'] = a.breed || '';
        if (exportConfig.gender) row['Sesso'] = a.gender || '';
        if (exportConfig.dateOfBirth) row['Data Nascita'] = a.dateOfBirth || '';
        if (exportConfig.entryDate) row['Data Ingresso'] = a.entryDate || '';
        if (exportConfig.origin) row['Provenienza'] = a.origin || '';
        if (exportConfig.exitDate) row['Data Uscita'] = a.exitDate || '';
        if (exportConfig.destination) row['Destinazione'] = a.destination || '';
        if (exportConfig.mod4) row['Mod 4'] = a.mod4 || '';
        if (exportConfig.healthStatus) row['Salute'] = a.healthStatus || '';
        if (exportConfig.motherId) row['Madre'] = a.motherId || '';
        if (exportConfig.fatherId) row['Padre'] = a.fatherId || '';
        if (exportConfig.documentUrl) row['Documenti'] = a.documentUrl || '';
        
        if (exportConfig.treatments) {
            const tr = await getTreatmentsForAnimal(a.id);
            row['Trattamenti (Storico)'] = tr.map(t => `${t.date}: ${t.type}`).join('; ');
        }
        if (exportConfig.weights) {
            const wr = await getWeightsForAnimal(a.id);
            row['Pesi (Storico)'] = wr.map(w => `${w.date}: ${w.weight}kg`).join('; ');
        }
        if (exportConfig.offspring) {
            const off = animals.filter(child => child.motherId === a.id || child.fatherId === a.id);
            row['Prole'] = off.map(c => c.earTag).join(', ');
        }
        if (exportConfig.photos && a.photoUrls && a.photoUrls.length > 0) {
            row['Foto Base64'] = exportFormat === 'pdf' ? '[IMG]' : `[${a.photoUrls.length} Foto Presenti]`;
        } else if (exportConfig.photos) {
            row['Foto Base64'] = '';
        }

        rows.push(row);
      }

      if (exportFormat === 'csv') {
        const csvContent = "data:text/csv;charset=utf-8," + 
          [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "mooshion-report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (exportFormat === 'xlsx') {
        const ws = xlsx.utils.json_to_sheet(rows, { header: headers });
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Animali");
        xlsx.writeFile(wb, "mooshion-report.xlsx");
      } else if (exportFormat === 'pdf') {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Report MOOSHion - Dettaglio Bestiame", 14, 15);
        
        let photoColIndex = -1;
        if (exportConfig.photos) {
           photoColIndex = headers.indexOf('Foto Base64');
        }

        const pdfRows = rows.map(r => headers.map(h => String(r[h])));
        autoTable(doc, {
          startY: 20,
          head: [headers],
          body: pdfRows,
          theme: 'grid',
          styles: { fontSize: 8, font: 'helvetica', cellPadding: 2, minCellHeight: exportConfig.photos ? 12 : 5 },
          headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
          didDrawCell: (data: any) => {
             if (exportConfig.photos && data.section === 'body' && data.column.index === photoColIndex) {
                 const animalRow = exportAnimals[data.row.index];
                 if (animalRow && animalRow.photoUrls && animalRow.photoUrls[0]) {
                     const dim = 10;
                     try {
                       const imgData = animalRow.photoUrls[0];
                       if (imgData.startsWith('data:image')) {
                           doc.addImage(imgData, data.cell.x + 2, data.cell.y + 1, dim, dim);
                       }
                     } catch(e) {}
                 }
             }
          }
        });
        doc.save("mooshion-report.pdf");
      }
    } finally {
      setExportProgress('');
      setIsExportModalOpen(false);
    }
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
    const data: any = {
      earTag: formData.get('earTag') as string,
      name: formData.get('name') as string,
      species: formData.get('species') as string,
      gender: formData.get('gender') as string,
      dateOfBirth: formData.get('dateOfBirth') as string,
      breed: formData.get('breed') as string,
      healthStatus: formData.get('healthStatus') as string || 'Sano',
      photoUrl: formData.get('photoUrl') as string,
      photoUrls: uploadedPhotos,
      motherId: formData.get('motherId') as string || undefined,
      fatherId: formData.get('fatherId') as string || undefined,
      entryDate: formData.get('entryDate') as string,
      origin: formData.get('origin') as string,
      exitDate: formData.get('exitDate') as string,
      destination: formData.get('destination') as string,
      mod4: formData.get('mod4') as string,
      documentUrl: formData.get('documentUrl') as string,
      userId: user.id,
    };

    // Clean up empty fields
    Object.keys(data).forEach(key => {
      if (data[key] === '' || (Array.isArray(data[key]) && data[key].length === 0)) {
        delete data[key];
      }
    });

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
    setUploadedPhotos([]);
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
          <button onClick={() => { setExportFormat('xlsx'); setIsExportModalOpen(true); }} className="text-xs border border-[var(--fg-color)] bg-[var(--card-bg)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
            Exp XLSX
          </button>
          <button onClick={() => { setExportFormat('csv'); setIsExportModalOpen(true); }} className="text-xs border border-[var(--fg-color)] bg-[var(--card-bg)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
            Exp CSV
          </button>
          <button onClick={() => { setExportFormat('pdf'); setIsExportModalOpen(true); }} className="text-xs border border-[var(--fg-color)] bg-[var(--card-bg)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
            Exp PDF
          </button>
          <button type="button" onClick={() => setIsModalOpen(true)} className="flex items-center text-xs border border-[var(--fg-color)] bg-[var(--fg-color)] text-[var(--bg-color)] px-4 py-3 font-bold uppercase tracking-widest hover:bg-[var(--bg-color)] hover:text-[var(--fg-color)] transition-colors shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] cursor-pointer">
            <Plus size={14} className="mr-1" />
            Nuovo Capo
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative max-w-sm flex-1">
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
        <button onClick={() => setIsQRScannerOpen(true)} className="p-3 bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[4px_4px_0px_0px_var(--fg-color)] hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all flex items-center gap-2" title="Scansione QR per Ricerca / Navigazione">
          <QrCode size={18} />
          <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:inline">Scanner QR</span>
        </button>
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
                      {animal.photoUrl || (animal.photoUrls && animal.photoUrls.length > 0) ? (
                         <img src={animal.photoUrls?.[0] || animal.photoUrl} alt="" className="w-10 h-10 border border-[var(--fg-color)] object-cover grayscale group-hover:grayscale-0 transition-all" />
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
                    {(animal.dateOfBirth || '').split('-').reverse().join('/')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-[10px] uppercase font-bold tracking-widest gap-2 flex justify-end">
                    <Link to={`/animal/${animal.id}`} className="border border-[var(--fg-color)] text-[var(--fg-color)] bg-[var(--card-bg)] group-hover:bg-transparent group-hover:border-[var(--bg-color)] group-hover:text-[var(--bg-color)] px-3 py-1.5 transition-colors">Dettagli</Link>
                    <button onClick={() => { setEditingAnimal(animal); setUploadedPhotos(animal.photoUrls || []); setIsModalOpen(true); }} className="border border-[var(--fg-color)] text-[var(--fg-color)] bg-[var(--card-bg)] group-hover:bg-transparent group-hover:border-[var(--bg-color)] group-hover:text-[var(--bg-color)] px-3 py-1.5 transition-colors">Modifica</button>
                    <button onClick={(e) => { e.stopPropagation(); setAnimalToDelete(animal.id); }} className="border border-[var(--fg-color)] text-[var(--fg-color)] bg-red-200 group-hover:bg-red-600 group-hover:text-white group-hover:border-transparent px-3 py-1.5 transition-colors">Elimina</button>
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
                      <select required name="species" defaultValue={editingAnimal?.species || 'Bovino'} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="Bovino">Bovino</option>
                        <option value="Altro">Altro</option>
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Sesso</label>
                      <select name="gender" defaultValue={editingAnimal?.gender || ''} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="">-- Seleziona --</option>
                        <option value="F">Femmina</option>
                        <option value="M">Maschio</option>
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data di Nascita</label>
                      <input type="date" name="dateOfBirth" defaultValue={editingAnimal?.dateOfBirth} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Razza</label>
                      <select name="breed" defaultValue={editingAnimal?.breed || ''} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="">-- Seleziona --</option>
                        <option value="Chianina">Chianina</option>
                        <option value="Meticcio/Incrocio">Meticcio/Incrocio</option>
                        <option value="Altro">Altro</option>
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data di Ingresso</label>
                      <input type="date" name="entryDate" defaultValue={editingAnimal?.entryDate} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Provenienza</label>
                      <input type="text" name="origin" defaultValue={editingAnimal?.origin} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Data Uscita (Morte/Vendita)</label>
                      <input type="date" name="exitDate" defaultValue={editingAnimal?.exitDate} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Destinazione</label>
                      <input type="text" name="destination" defaultValue={editingAnimal?.destination} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Mod 4</label>
                      <input type="text" name="mod4" defaultValue={editingAnimal?.mod4} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Stato Salute</label>
                      <select name="healthStatus" defaultValue={editingAnimal?.healthStatus || 'Sano'} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="Sano">Sano</option>
                        <option value="Malato">Malato</option>
                        <option value="In Osservazione">In Osservazione</option>
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Madre</label>
                      <select name="motherId" defaultValue={editingAnimal?.motherId || ''} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="">-- Nessuna --</option>
                        {animals.filter(a => a.gender === 'F' && a.id !== editingAnimal?.id).map(a => (
                          <option key={a.id} value={a.id}>{a.earTag} {a.name ? `(${a.name})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Padre</label>
                      <select name="fatherId" defaultValue={editingAnimal?.fatherId || ''} className="block w-full border border-[var(--fg-color)] bg-[var(--card-bg)] py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)] font-mono">
                        <option value="">-- Nessuno --</option>
                        {animals.filter(a => a.gender === 'M' && a.id !== editingAnimal?.id).map(a => (
                          <option key={a.id} value={a.id}>{a.earTag} {a.name ? `(${a.name})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">URL Foto Singola (Vecchio formato)</label>
                      <input type="url" name="photoUrl" defaultValue={editingAnimal?.photoUrl} placeholder="https://..." className="block w-full border border-[var(--fg-color)] bg-[var(--bg-color)]/30 py-2 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                    </div>
                    <div className="col-span-2">
                       <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Carica Foto (Verranno incluse nel PDF)</label>
                       <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="block w-full border border-[var(--fg-color)] bg-[var(--bg-color)]/30 py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
                       {uploadedPhotos.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                             {uploadedPhotos.map((p, i) => (
                                <div key={i} className="relative w-16 h-16 border border-[var(--fg-color)]">
                                   <img src={p} className="w-full h-full object-cover" />
                                   <button type="button" onClick={() => removePhoto(i)} className="absolute -top-2 -right-2 bg-red-500 text-white p-0.5 rounded-full"><Trash2 size={12} /></button>
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">URL Documenti (PDF/Word/Foto)</label>
                      <input type="url" name="documentUrl" defaultValue={editingAnimal?.documentUrl} placeholder="https://..." className="block w-full border border-[var(--fg-color)] bg-[var(--bg-color)]/30 py-2 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--fg-color)]" />
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

      {/* Export Config Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 transition-opacity bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setIsExportModalOpen(false)}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
               <h3 className="text-2xl font-bold tracking-tighter uppercase mb-2 flex items-center gap-2">
                 <Settings2 className="w-6 h-6" /> Export {exportFormat.toUpperCase()}
               </h3>
               
               <div className="mb-6 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-widest border-b border-[var(--fg-color)] pb-2 opacity-80">Filtri Report</h4>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="block text-[8px] uppercase tracking-widest opacity-60">Razza</label>
                        <select className="w-full text-xs border border-[var(--fg-color)] bg-[var(--bg-color)] p-1 focus:outline-none" value={exportFilters.breed} onChange={e => setExportFilters(p => ({ ...p, breed: e.target.value }))}>
                           <option value="">Tutte</option>
                           {[...new Set(animals.map(a => a.breed).filter(Boolean))].map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-[8px] uppercase tracking-widest opacity-60">Stato Salute</label>
                        <select className="w-full text-xs border border-[var(--fg-color)] bg-[var(--bg-color)] p-1 focus:outline-none" value={exportFilters.healthStatus} onChange={e => setExportFilters(p => ({ ...p, healthStatus: e.target.value }))}>
                           <option value="">Tutti</option>
                           <option value="Sano">Sano</option>
                           <option value="Malato">Malato</option>
                           <option value="In Osservazione">In Osservazione</option>
                        </select>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] uppercase tracking-widest opacity-60">Nati Da</label>
                        <input type="date" className="w-full text-xs font-mono border border-[var(--fg-color)] bg-[var(--bg-color)] p-1 focus:outline-none" value={exportFilters.dateRange.start} onChange={e => setExportFilters(p => ({ ...p, dateRange: { ...p.dateRange, start: e.target.value } }))} />
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase tracking-widest opacity-60">Nati Fino A</label>
                        <input type="date" className="w-full text-xs font-mono border border-[var(--fg-color)] bg-[var(--bg-color)] p-1 focus:outline-none" value={exportFilters.dateRange.end} onChange={e => setExportFilters(p => ({ ...p, dateRange: { ...p.dateRange, end: e.target.value } }))} />
                      </div>
                  </div>
               </div>

               <p className="font-serif italic text-[11px] uppercase opacity-60 mb-6 border-b border-[var(--fg-color)] pb-4 flex justify-between items-center">
                 Seleziona i campi da esportare
                 <div className="flex gap-2">
                   <button onClick={() => checkAllExport(true)} className="text-[9px] underline">Tutti</button>
                   <button onClick={() => checkAllExport(false)} className="text-[9px] underline">Nessuno</button>
                 </div>
               </p>
               
               <div className="grid grid-cols-2 gap-4 font-mono text-sm uppercase">
                  {Object.entries(exportConfig).map(([key, value]) => {
                     const labels: any = {
                        earTag: 'Orecchino', name: 'Nome', species: 'Specie', breed: 'Razza', gender: 'Sesso',
                        dateOfBirth: 'Data Nascita', entryDate: 'Data Ingresso', origin: 'Provenienza',
                        exitDate: 'Data Uscita', destination: 'Destinazione', mod4: 'Mod 4', healthStatus: 'Salute',
                        motherId: 'Madre', fatherId: 'Padre', documentUrl: 'Documenti',
                        treatments: 'Trattamenti', weights: 'Storico Pesi', offspring: 'Prole', photos: 'Foto'
                     };
                     return (
                      <label key={key} className="flex items-center space-x-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center shrink-0">
                            <input type="checkbox" className="sr-only" checked={value} onChange={() => setExportConfig(prev => ({ ...prev, [key]: !prev[key as keyof typeof exportConfig] }))} />
                            <div className={`w-5 h-5 flex items-center justify-center border transition-colors ${value ? 'bg-[var(--fg-color)] border-[var(--fg-color)]' : 'bg-transparent border-[var(--fg-color)] group-hover:bg-[var(--fg-color)]/10'}`}>
                                {value && <div className="w-2.5 h-2.5 bg-[var(--bg-color)]"></div>}
                            </div>
                          </div>
                          <span className="font-bold tracking-widest text-[10px] break-all truncate" title={labels[key]}>{labels[key]}</span>
                      </label>
                     );
                  })}
               </div>

               <div className="mt-8 flex gap-3 flex-col sm:flex-row">
                  {exportProgress ? (
                     <div className="flex-1 w-full text-center py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] opacity-70 animate-pulse">
                        {exportProgress}
                     </div>
                  ) : (
                    <>
                      <button onClick={executeExport} className="flex-1 w-full inline-flex justify-center border border-transparent bg-[var(--fg-color)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--bg-color)] shadow-[2px_2px_0px_0px_var(--fg-color)] hover:bg-[var(--card-bg)] hover:border-[var(--fg-color)] hover:text-[var(--fg-color)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">
                         Genera File
                      </button>
                      <button onClick={() => setIsExportModalOpen(false)} className="w-auto inline-flex justify-center border border-[var(--fg-color)] bg-[var(--card-bg)] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-color)] hover:bg-[var(--bg-color)] transition-colors">
                         Chiudi
                      </button>
                    </>
                  )}
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
                     if (result && result.length > 0) {
                        const val = result[0].rawValue;
                        setIsQRScannerOpen(false);
                        
                        if (val.startsWith(window.location.origin + '/animal/')) {
                            window.location.href = val;
                        } else if (val.startsWith('http')) {
                            window.location.href = val;
                        } else {
                            if (isModalOpen && earTagRef.current) {
                               earTagRef.current.value = val;
                            } else {
                               setSearchTerm(val);
                            }
                        }
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

      {/* Delete Confirmation Modal */}
      {animalToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-[var(--fg-color)]/50 backdrop-blur-sm" onClick={() => setAnimalToDelete(null)}></div>
            <div className="relative inline-block align-bottom bg-[var(--card-bg)] border border-[var(--fg-color)] shadow-[8px_8px_0px_0px_var(--fg-color)] text-left transform transition-all sm:my-8 sm:align-middle sm:max-w-sm w-full p-8 text-center flex flex-col items-center">
               <h3 className="text-xl font-bold uppercase tracking-tighter mb-4 text-red-600">Elimina Animale</h3>
               <p className="mb-6 text-sm font-mono opacity-80">Sei sicuro di voler eliminare questo animale? L'operazione è <span className="font-bold underline">irreversibile</span>.</p>
               <div className="flex gap-4 w-full">
                  <button onClick={() => setAnimalToDelete(null)} className="flex-1 bg-[var(--card-bg)] border border-[var(--fg-color)] px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--fg-color)] hover:text-[var(--bg-color)] transition-colors active:translate-y-[2px] active:translate-x-[2px] shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none">
                     Annulla
                  </button>
                  <button onClick={async () => { await deleteAnimal(animalToDelete); setAnimalToDelete(null); }} className="flex-1 bg-red-600 outline-none border border-red-600 text-white px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors active:translate-y-[2px] active:translate-x-[2px] shadow-[2px_2px_0px_0px_var(--fg-color)] active:shadow-none">
                     Elimina
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
