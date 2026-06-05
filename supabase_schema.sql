-- Schema creation for Cattle Tracker on Supabase

-- Note: Se stai riscontrando errori "new row violates row-level security policy",
-- significa che Supabase ha abilitato la "Row Level Security" (RLS) di default
-- sulle tue tabelle, ma non ci sono policy impostate.
-- Puoi eseguire i seguenti comandi per DISABILITARE la RLS e permettere il
-- corretto funzionamento dell'app (se non stai usando l'autenticazione integrata di Supabase):

ALTER TABLE IF EXISTS public.animals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."weightRecords" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."feedStocks" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."feedTransactions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."milkRecords" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.geozones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.treatments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weight_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."auditLogs" DISABLE ROW LEVEL SECURITY;

-- 1. animals
CREATE TABLE IF NOT EXISTS public.animals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "earTag" TEXT NOT NULL,
    "name" TEXT,
    "species" TEXT,
    "breed" TEXT,
    "gender" TEXT,
    "dateOfBirth" TEXT,
    "healthStatus" TEXT,
    "motherId" TEXT,
    "fatherId" TEXT,
    "photoUrl" TEXT,
    "currentWeight" NUMERIC,
    "gpsTagId" TEXT,
    "lastLocation" JSONB,
    "createdAt" BIGINT,
    "updatedAt" BIGINT
);

-- Note: Se avevi già creato la tabella, esegui questi comandi per aggiungere le colonne mancanti:
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS "motherId" TEXT;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS "fatherId" TEXT;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS "currentWeight" NUMERIC;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS "gpsTagId" TEXT;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS "lastLocation" JSONB;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS "updatedAt" BIGINT;

-- DROP delle colonne obsolete che non usiamo direttamente:
-- ALTER TABLE public.animals DROP COLUMN IF EXISTS "latitude";
-- ALTER TABLE public.animals DROP COLUMN IF EXISTS "longitude";

-- 2. weightRecords
CREATE TABLE IF NOT EXISTS public."weightRecords" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "animalId" TEXT,
    "date" TEXT,
    "weight" NUMERIC,
    "createdAt" BIGINT
);

-- 3. feedStocks
CREATE TABLE IF NOT EXISTS public."feedStocks" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "quantity" NUMERIC,
    "unit" TEXT,
    "reorderPoint" NUMERIC,
    "createdAt" BIGINT
);

-- 4. feedTransactions
CREATE TABLE IF NOT EXISTS public."feedTransactions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "stockId" TEXT,
    "type" TEXT,
    "amount" NUMERIC,
    "date" TEXT,
    "notes" TEXT,
    "createdAt" BIGINT
);

-- 5. alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "type" TEXT,
    "message" TEXT,
    "date" TEXT,
    "isRead" BOOLEAN DEFAULT false,
    "createdAt" BIGINT
);

-- 6. milkRecords
CREATE TABLE IF NOT EXISTS public."milkRecords" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "animalId" TEXT,
    "date" TEXT,
    "amount" NUMERIC,
    "quality" TEXT,
    "createdAt" BIGINT
);

-- 7. collaborators
CREATE TABLE IF NOT EXISTS public.collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" BIGINT
);

-- 8. geozones
CREATE TABLE IF NOT EXISTS public.geozones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "coordinates" JSONB,
    "createdAt" BIGINT
);

-- 9. treatments (sub-collection of animals)
CREATE TABLE IF NOT EXISTS public.treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "animalId" TEXT NOT NULL,
    "type" TEXT,
    "date" TEXT,
    "notes" TEXT,
    "createdAt" BIGINT
);

-- 10. weight_history (sub-collection of animals)
CREATE TABLE IF NOT EXISTS public.weight_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "animalId" TEXT NOT NULL,
    "weight" NUMERIC,
    "date" TEXT,
    "createdAt" BIGINT
);

-- 11. photos (sub-collection of animals)
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "animalId" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" BIGINT
);

-- 12. auditLogs
CREATE TABLE IF NOT EXISTS public."auditLogs" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "action" TEXT,
    "collectionName" TEXT,
    "timestamp" TEXT,
    "details" TEXT,
    "createdAt" BIGINT
);
