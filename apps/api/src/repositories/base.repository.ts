import {
  Firestore,
  CollectionReference,
  DocumentReference,
  DocumentData,
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
  getDocs,
  query,
  QueryConstraint,
} from 'firebase/firestore';
import { Inject } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';

export abstract class BaseRepository<T extends { id: string }> {
  protected readonly collection: CollectionReference<DocumentData>;

  constructor(
    @Inject('FIRESTORE') protected readonly firestore: Firestore,
    protected readonly logger: LoggingService,
    collectionPath: string,
  ) {
    this.collection = collection(this.firestore, collectionPath);
    this.logger.setContext(this.constructor.name); // Set context to the specific repository name
  }

  protected getDocRef(id: string): DocumentReference<DocumentData> {
    return doc(this.firestore, this.collection.path, id);
  }

  protected mapDocToModel(docSnap: DocumentData): T {
    const data = docSnap.data();
    const mappedData = {
      ...data,
      id: docSnap.id,
      // Convert Timestamps to Dates, handle potential missing fields
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
    } as T;

    // Add specific field mappings or transformations if needed in subclasses
    return this.postMap(mappedData);
  }

  /**
   * Optional post-mapping hook for subclasses to perform additional transformations.
   */
  protected postMap(data: T): T {
    return data;
  }

  /**
   * Prepares data for saving (add or update). Removes 'id' and adds/updates timestamps.
   */
   protected prepareForSave(data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>> & { id?: string }): DocumentData {
        const dataToSave: any = { ...data };
        delete dataToSave.id; // Remove 'id' before saving

        dataToSave.updatedAt = serverTimestamp();
        if (!data.id) { // Add createdAt only for new documents
            dataToSave.createdAt = serverTimestamp();
        }

        // Add specific pre-save transformations if needed in subclasses
        return this.preSave(dataToSave);
    }

   /**
    * Optional pre-save hook for subclasses to perform validation or data transformation.
    */
   protected preSave(data: DocumentData): DocumentData {
       return data;
   }


  async findById(id: string): Promise<T | null> {
     if (!id) { this.logger.warn(`findById called with empty ID.`); return null; }
     const docRef = this.getDocRef(id);
     try {
       const docSnap = await getDoc(docRef);
       if (docSnap.exists()) {
         return this.mapDocToModel(docSnap);
       } else {
         this.logger.log(`No document found with ID: ${id} in collection ${this.collection.path}`);
         return null;
       }
     } catch (error) {
       this.logger.error(`Error finding document ${id} in ${this.collection.path}`, error instanceof Error ? error.stack : undefined);
       throw new Error(`Failed to find document ${id}.`);
     }
  }

   async findAll(constraints: QueryConstraint[] = []): Promise<T[]> {
        const q = query(this.collection, ...constraints);
        try {
            const querySnapshot = await getDocs(q);
            const results: T[] = [];
            querySnapshot.forEach((docSnap) => {
                results.push(this.mapDocToModel(docSnap));
            });
            return results;
        } catch (error) {
            this.logger.error(`Error finding all documents in ${this.collection.path}`, error instanceof Error ? error.stack : undefined, { constraints: constraints.map(c => c.type) });
            throw new Error(`Failed to find all documents in ${this.collection.path}.`);
        }
    }


  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
     const dataToSave = this.prepareForSave(data);
     try {
       const docRef = await addDoc(this.collection, dataToSave);
       this.logger.log(`Document created with ID: ${docRef.id} in ${this.collection.path}`);
       return docRef.id;
     } catch (error) {
       this.logger.error(`Error creating document in ${this.collection.path}`, error instanceof Error ? error.stack : undefined);
       throw new Error(`Failed to create document in ${this.collection.path}.`);
     }
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    if (!id) { this.logger.error(`update called with empty ID.`); throw new Error("ID required for update."); }
    const docRef = this.getDocRef(id);
    const dataToSave = this.prepareForSave({ ...data, id }); // Pass id for preSave logic if needed
    try {
      await updateDoc(docRef, dataToSave);
      this.logger.log(`Document updated: ${id} in ${this.collection.path}`);
    } catch (error) {
      this.logger.error(`Error updating document ${id} in ${this.collection.path}`, error instanceof Error ? error.stack : undefined);
      throw new Error(`Failed to update document ${id}.`);
    }
  }

   async set(id: string, data: Omit<T, 'createdAt' | 'updatedAt'>): Promise<void> {
       if (!id) { this.logger.error(`set called with empty ID.`); throw new Error("ID required for set."); }
       const docRef = this.getDocRef(id);
       const dataToSave = this.prepareForSave({ ...data, id }); // Pass id for preSave logic
       try {
           await setDoc(docRef, dataToSave, { merge: true }); // Use merge:true to allow partial updates or create if not exists
           this.logger.log(`Document set (created or merged): ${id} in ${this.collection.path}`);
       } catch (error) {
           this.logger.error(`Error setting document ${id} in ${this.collection.path}`, error instanceof Error ? error.stack : undefined);
           throw new Error(`Failed to set document ${id}.`);
       }
   }

  async delete(id: string): Promise<void> {
    if (!id) { this.logger.error(`delete called with empty ID.`); throw new Error("ID required for delete."); }
    const docRef = this.getDocRef(id);
    try {
      await deleteDoc(docRef);
      this.logger.log(`Document deleted: ${id} in ${this.collection.path}`);
    } catch (error) {
      this.logger.error(`Error deleting document ${id} in ${this.collection.path}`, error instanceof Error ? error.stack : undefined);
      throw new Error(`Failed to delete document ${id}.`);
    }
  }
}
