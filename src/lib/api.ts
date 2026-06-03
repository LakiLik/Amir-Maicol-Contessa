import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, query, where, updateDoc } from '../lib/db-mock';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Animal, Treatment, WeightRecord } from '../types';

export const subscribeToAnimals = (userId: string, callback: (animals: Animal[]) => void) => {
  const q = query(collection(db, 'animals'), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const animals = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Animal));
    callback(animals);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'animals');
  });
};

export const addAnimal = async (animal: Omit<Animal, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const newDocRef = doc(collection(db, 'animals'));
    const now = Date.now();
    await setDoc(newDocRef, { ...animal, createdAt: now, updatedAt: now });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'animals');
  }
};

export const updateAnimal = async (id: string, updates: Partial<Animal>, currentUserId: string) => {
  try {
    const docRef = doc(db, 'animals', id);
    // Explicitly update updatedAt and carry over userId if we want.
    // Our rules require: userId == existing().userId and updatedAt == request.time
    await updateDoc(docRef, { ...updates, updatedAt: Date.now() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `animals/${id}`);
  }
};

export const deleteAnimal = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'animals', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `animals/${id}`);
  }
};

// Treatments
export const subscribeToTreatments = (animalId: string, callback: (treatments: Treatment[]) => void) => {
  // We need to pass the query. Since it's a subcollection we just get all for this animal.
  const colRef = collection(db, 'animals', animalId, 'treatments');
  return onSnapshot(colRef, (snapshot) => {
    const treatments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Treatment));
    callback(treatments);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `animals/${animalId}/treatments`);
  });
};

export const addTreatment = async (animalId: string, treatment: Omit<Treatment, 'id' | 'createdAt'>) => {
    try {
      const newDocRef = doc(collection(db, 'animals', animalId, 'treatments'));
      await setDoc(newDocRef, { ...treatment, createdAt: Date.now() });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `animals/${animalId}/treatments`);
    }
};

// Weight Records
export const subscribeToWeights = (animalId: string, callback: (weights: WeightRecord[]) => void) => {
  const colRef = collection(db, 'animals', animalId, 'weight_history');
  return onSnapshot(colRef, (snapshot) => {
    const weights = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WeightRecord));
    callback(weights);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `animals/${animalId}/weight_history`);
  });
};

export const addWeightRecord = async (animalId: string, record: Omit<WeightRecord, 'id' | 'createdAt'>) => {
    try {
      const newDocRef = doc(collection(db, 'animals', animalId, 'weight_history'));
      await setDoc(newDocRef, { ...record, createdAt: Date.now() });
      
      // Update the main animal record with currentWeight
      const animalRef = doc(db, 'animals', animalId);
      await updateDoc(animalRef, { currentWeight: record.weight, updatedAt: Date.now() });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `animals/${animalId}/weight_history`);
    }
};
