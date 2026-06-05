import { supabase } from './supabase';

export const db = {};

export const collection = (db: any, ...paths: string[]) => paths.join('/');

export const doc = (db: any, ...rest: string[]) => {
  if (rest.length > 2) {
    return { path: rest.slice(0, -1).join('/'), id: rest[rest.length - 1] };
  } else if (rest.length === 2) {
     return { path: rest[0], id: rest[1] };
  } else if (rest.length === 1) {
      const parts = rest[0].split('/');
      return { path: parts.slice(0, -1).join('/'), id: parts[parts.length - 1] || '' };
  } else if (rest.length === 0 && typeof db === 'string') {
      return { path: db, id: crypto.randomUUID() };
  }
  return { path: '', id: '' };
};

export const query = (col: string, ...filters: any[]) => {
  return { col, filters };
};

export const where = (field: string, op: string, value: any) => {
  return { field, op, value };
};

export const getDocs = async (queryOrCol: any) => {
  let table = '';
  let filters: any[] = [];

  if (typeof queryOrCol === 'string') {
      table = queryOrCol;
  } else if (queryOrCol && queryOrCol.col) {
      table = queryOrCol.col;
      filters = queryOrCol.filters || [];
  } else {
      console.warn("Invalid query object passed to getDocs:", queryOrCol);
      return { docs: [], forEach: () => {} };
  }

  let builder: any;
  const parts = table.split('/');
  if (parts.length === 3) {
      table = parts[2];
      builder = supabase.from(table).select('*').eq('animalId', parts[1]);
  } else {
      builder = supabase.from(table).select('*');
  }

  for (const filter of filters) {
    if (filter.op === '==') {
      builder = builder.eq(filter.field, filter.value);
    } else if (filter.op === 'in') {
      builder = builder.in(filter.field, filter.value);
    }
  }
  const { data, error } = await builder;
  if (error) {
     console.error("Supabase getDocs error:", error);
     return { docs: [], forEach: () => {} };
  }
  return {
    docs: (data || []).map((d: any) => ({
      id: d.id,
      data: () => d
    })),
    forEach: (cb: any) => {
      (data || []).forEach((d: any) => cb({ id: d.id, data: () => d }));
    }
  };
};

export const getDoc = async (d: any) => {
  if (!d || !d.path) {
    console.warn("Invalid document reference passed to getDoc:", d);
    return { id: d?.id, exists: () => false, data: () => null };
  }
  let table = d.path;
  const parts = table.split('/');
  if (parts.length === 3) {
      table = parts[2];
  }
  const { data, error } = await supabase.from(table).select('*').eq('id', d.id).single();
  if (error) {
     console.error("Supabase getDoc error:", error);
     return { id: d.id, exists: () => false, data: () => null };
  }
  return {
    id: d.id,
    exists: () => !!data,
    data: () => data
  };
};

export const onSnapshot = (ref: any, cb: any, onError?: any) => {
  const isDoc = ref && typeof ref === 'object' && ref.path && !ref.col;
  let table = '';
  
  if (isDoc) {
      table = ref.path;
  } else if (typeof ref === 'string') {
      table = ref;
  } else if (ref && ref.col) {
      table = ref.col;
  } else {
      console.warn("Invalid ref passed to onSnapshot:", ref);
      return () => {};
  }

  const parts = table.split('/');
  if (parts.length === 3) {
      table = parts[2];
  }

  const channelName = 'public:' + table + ':' + Math.random().toString(36).substring(7);
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, payload => {
       if (isDoc) {
           getDoc(ref).then(cb).catch(err => { if (onError) onError(err); });
       } else {
           getDocs(ref).then(cb).catch(err => { if (onError) onError(err); });
       }
    })
    .subscribe();
  
  if (isDoc) {
     getDoc(ref).then(cb).catch(err => { if (onError) onError(err); });
  } else {
     getDocs(ref).then(cb).catch(err => { if (onError) onError(err); });
  }

  return () => {
    supabase.removeChannel(channel);
  };
};

const cleanPayload = (obj: any) => {
  const cleaned: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      cleaned[k] = v;
    }
  }
  return cleaned;
};

export const addDoc = async (col: string, data: any) => {
  let table = col;
  const parts = table.split('/');
  let payload = cleanPayload({ ...data });
  if (parts.length === 3) {
      table = parts[2];
      payload.animalId = parts[1];
  }

  const attemptInsert = async (currentPayload: any): Promise<any> => {
    const { data: res, error } = await supabase.from(table).insert([currentPayload]).select();
    if (error) {
       if (error.code === 'PGRST204' || error.code === 'PGRST205') {
          const match = error.message?.match(/Could not find the '([^']+)' column/);
          if (match && match[1]) {
             const colName = match[1];
             console.warn(`[Auto-Fix] Column '${colName}' not found in '${table}'. Removing from payload and retrying. Please update your Supabase schema!`);
             const nextPayload = { ...currentPayload };
             delete nextPayload[colName];
             return attemptInsert(nextPayload);
          }
       }
       console.error(`Supabase addDoc error on table ${table}:`, error);
       throw error;
    }
    return { id: res[0].id };
  };

  return attemptInsert(payload);
};

export const setDoc = async (d: any, data: any) => {
  let table = d.path;
  const parts = table.split('/');
  let payload = cleanPayload({ ...data });
  if (parts.length === 3) {
      table = parts[2];
      payload.animalId = parts[1];
  }

  const attemptUpsert = async (currentPayload: any): Promise<void> => {
    const { error: upsertErr } = await supabase.from(table).upsert({ ...currentPayload, id: d.id });
    if (upsertErr) {
       if (upsertErr.code === 'PGRST204' || upsertErr.code === 'PGRST205') {
          const match = upsertErr.message?.match(/Could not find the '([^']+)' column/);
          if (match && match[1]) {
             const colName = match[1];
             console.warn(`[Auto-Fix] Column '${colName}' not found in '${table}'. Removing from payload and retrying upsert. Please update your Supabase schema!`);
             const nextPayload = { ...currentPayload };
             delete nextPayload[colName];
             return attemptUpsert(nextPayload);
          }
       }
       console.error("Supabase setDoc (upsert) error:", upsertErr);
       throw upsertErr;
    }
  };

  return attemptUpsert(payload);
};

export const updateDoc = async (d: any, data: any) => {
  let finalData = cleanPayload({ ...data });
  let table = d.path;
  const parts = table.split('/');
  if (parts.length === 3) {
      table = parts[2];
  }
  
  const attemptUpdate = async (currentPayload: any): Promise<void> => {
    const { error } = await supabase.from(table).update(currentPayload).eq('id', d.id);
    if (error) {
       if (error.code === 'PGRST204' || error.code === 'PGRST205') {
          const match = error.message?.match(/Could not find the '([^']+)' column/);
          if (match && match[1]) {
             const colName = match[1];
             console.warn(`[Auto-Fix] Column '${colName}' not found in '${table}'. Removing from payload and retrying update. Please update your Supabase schema!`);
             const nextPayload = { ...currentPayload };
             delete nextPayload[colName];
             return attemptUpdate(nextPayload);
          }
       }
       console.error("Supabase updateDoc error:", error);
       throw error;
    }
  };

  return attemptUpdate(finalData);
};

export const deleteDoc = async (d: any) => {
  let table = d.path;
  const parts = table.split('/');
  if (parts.length === 3) {
      table = parts[2];
  }
  const { error } = await supabase.from(table).delete().eq('id', d.id);
  if (error) {
     console.error("Supabase deleteDoc error:", error);
     throw error;
  }
};

export const increment = (amount: number) => {
  // Mock as a flat amount for simplified API wrapping (would need dynamic property updates/rpc ideally in supabase)
  return amount;
};

export const serverTimestamp = () => new Date().toISOString();

export enum OperationType {
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
}

export const handleFirestoreError = (error: any, op: string, path: string) => {
  console.error(`DB Error [${op}] at ${path}:`, error);
};
