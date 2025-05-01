
'use server'; // Indicate this module can contain server-only logic (like direct DB access)

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import type { Character } from '@/lib/types';

const charactersCollection = collection(db, 'characters');

/**
 * Saves a new character to Firestore.
 * @param characterData - The character data to save (without ID).
 * @returns The ID of the newly created character.
 */
export async function saveCharacter(characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const docRef = await addDoc(charactersCollection, {
      ...characterData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('Character saved with ID: ', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error('Error adding document: ', e);
    throw new Error('Failed to save character.');
  }
}

/**
 * Updates an existing character in Firestore.
 * @param characterId - The ID of the character to update.
 * @param characterData - The character data fields to update.
 */
export async function updateCharacter(characterId: string, characterData: Partial<Omit<Character, 'id' | 'createdAt'>>): Promise<void> {
  const characterDoc = doc(db, 'characters', characterId);
  try {
    await updateDoc(characterDoc, {
      ...characterData,
      updatedAt: serverTimestamp(),
    });
    console.log('Character updated with ID: ', characterId);
  } catch (e) {
    console.error('Error updating document: ', e);
    throw new Error('Failed to update character.');
  }
}

/**
 * Loads a specific character from Firestore.
 * @param characterId - The ID of the character to load.
 * @returns The character data, or null if not found.
 */
export async function loadCharacter(characterId: string): Promise<Character | null> {
  const characterDoc = doc(db, 'characters', characterId);
  try {
    const docSnap = await getDoc(characterDoc);
    if (docSnap.exists()) {
        const data = docSnap.data();
         // Convert Firestore Timestamps to Dates if they exist
        const character: Character = {
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
        } as Character; // Cast might be needed depending on strictness
      return character;
    } else {
      console.log('No such document!');
      return null;
    }
  } catch (e) {
    console.error('Error getting document: ', e);
    throw new Error('Failed to load character.');
  }
}

/**
 * Loads all characters (or potentially characters for a specific player if auth is added).
 * @returns An array of all character data.
 */
export async function loadAllCharacters(): Promise<Character[]> {
  // TODO: Add filtering by player ID if authentication is implemented
  const q = query(charactersCollection); // Simple query for all characters for now
  try {
    const querySnapshot = await getDocs(q);
    const characters: Character[] = [];
    querySnapshot.forEach((docSnap) => {
       const data = docSnap.data();
        // Convert Firestore Timestamps to Dates
        characters.push({
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
        } as Character); // Cast might be needed
    });
    return characters;
  } catch (e) {
    console.error('Error getting documents: ', e);
    throw new Error('Failed to load characters.');
  }
}

/**
 * Deletes a character from Firestore.
 * @param characterId - The ID of the character to delete.
 */
export async function deleteCharacter(characterId: string): Promise<void> {
  const characterDoc = doc(db, 'characters', characterId);
  try {
    await deleteDoc(characterDoc);
    console.log('Character deleted with ID: ', characterId);
  } catch (e) {
    console.error('Error deleting document: ', e);
    throw new Error('Failed to delete character.');
  }
}
