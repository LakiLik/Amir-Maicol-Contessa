import { v4 as uuidv4 } from 'uuid';

// Extremely basic localStorage-based mock for Firestore to avoid rewriting all UI code,
// because creating 10+ Supabase relational tables automatically from frontend isn't possible.
const STORAGE_KEY = 'agrosync_local_store';

function getStore() {
  const d = localStorage.getItem(STORAGE_KEY);
  return d ? JSON.parse(d) : {};
}

function saveStore(store: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  triggerCallbacks();
}

const listeners: Set<Function> = new Set();
function triggerCallbacks() {
  listeners.forEach(cb => cb());
}

export function collection(db: any, path: string, ...rest: string[]) {
   return { path: [path, ...rest].join('/') };
}

export function doc(dbOrCol: any, idOrPath?: string, id2?: string) {
    if (typeof dbOrCol === 'string' || !dbOrCol) {
        return { path: dbOrCol || idOrPath };
    }
    if (idOrPath && id2) return { path: dbOrCol.path ? `${dbOrCol.path}/${idOrPath}/${id2}` : `${idOrPath}/${id2}` };
    if (dbOrCol.path) {
        if (idOrPath) return { path: `${dbOrCol.path}/${idOrPath}` };
        return { path: `${dbOrCol.path}/${uuidv4()}` };
    }
    return { path: idOrPath || uuidv4() };
}

export function query(col: any, ...constraints: any[]) {
   return { path: col.path, constraints };
}

export function where(field: string, op: string, value: any) {
   return { field, op, value };
}

export async function getDocs(q: any) {
   const store = getStore();
   const allDocs = store[q.path] || {};
   let results = Object.keys(allDocs).map(id => ({ id, data: () => allDocs[id], ...allDocs[id] }));
   
   if (q.constraints) {
      q.constraints.forEach((c: any) => {
         if (c.op === '==') {
            results = results.filter((d: any) => d.data()[c.field] === c.value);
         }
      });
   }
   
   return { docs: results, forEach: (cb: any) => results.forEach(cb) };
}

export async function getDoc(dRef: any) {
   const pathParts = dRef.path.split('/');
   const id = pathParts.pop();
   const col = pathParts.join('/');
   const store = getStore();
   const data = (store[col] || {})[id];
   return {
       id,
       exists: () => !!data,
       data: () => data
   };
}

export async function setDoc(dRef: any, data: any) {
   const pathParts = dRef.path.split('/');
   const id = pathParts.pop();
   const col = pathParts.join('/');
   const store = getStore();
   if (!store[col]) store[col] = {};
   store[col][id!] = data;
   saveStore(store);
}

export async function addDoc(colRef: any, data: any) {
   const id = uuidv4();
   const store = getStore();
   if (!store[colRef.path]) store[colRef.path] = {};
   store[colRef.path][id] = data;
   saveStore(store);
   return { id };
}

export async function updateDoc(dRef: any, data: any) {
   const pathParts = dRef.path.split('/');
   const id = pathParts.pop();
   const col = pathParts.join('/');
   const store = getStore();
   if (!store[col]) store[col] = {};
   
   let existing = store[col][id!] || {};
   // handle increments broadly
   let updated = { ...data };
   Object.keys(updated).forEach(k => {
       if (updated[k] && updated[k]._isIncrement) {
           updated[k] = (existing[k] || 0) + updated[k].val;
       }
   });
   
   store[col][id!] = { ...existing, ...updated };
   saveStore(store);
}

export async function deleteDoc(dRef: any) {
   const pathParts = dRef.path.split('/');
   const id = pathParts.pop();
   const col = pathParts.join('/');
   const store = getStore();
   if (store[col] && store[col][id!]) {
       delete store[col][id!];
       saveStore(store);
   }
}

export function onSnapshot(q: any, cb: Function, errCb?: Function) {
   const fetchAndTrigger = () => {
       getDocs(q).then((res) => cb(res)).catch(e => errCb && errCb(e));
   };
   fetchAndTrigger();
   listeners.add(fetchAndTrigger);
   return () => {
       listeners.delete(fetchAndTrigger);
   };
}

export function increment(val: number) {
    return { _isIncrement: true, val };
}

export function serverTimestamp() {
    return Date.now();
}
