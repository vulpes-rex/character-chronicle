
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CollectionReference, Firestore, Timestamp, addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, or, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import type { Campaign, GameLogEntry, SourcePack, UserRole, Monster, NPC } from '@character-chronicle/shared/types'; // Use shared library path
import { LoggingService } from '../logging/logging.service'; // Updated path
import { SRD_SOURCE_PACK } from '@character-chronicle/shared/data'; // Use shared library path

@Injectable()
export class CampaignService {
  private readonly campaignsCollection: CollectionReference<Omit<Campaign, 'id'>>;
  private readonly gameLogsCollection: CollectionReference<Omit<GameLogEntry, 'id'>>;
  private readonly sourcePacksCollection: CollectionReference<Omit<SourcePack, 'id'>>;

  constructor(
    @Inject('FIRESTORE') private readonly firestore: Firestore,
    private readonly logger: LoggingService,
  ) {
    this.campaignsCollection = collection(this.firestore, 'campaigns') as CollectionReference<Omit<Campaign, 'id'>>;
    this.gameLogsCollection = collection(this.firestore, 'gameLogs') as CollectionReference<Omit<GameLogEntry, 'id'>>;
    this.sourcePacksCollection = collection(this.firestore, 'sourcePacks') as CollectionReference<Omit<SourcePack, 'id'>>;
    this.logger.setContext('CampaignService');
  }

  // --- Campaign Management ---

  async createCampaign(campaignData: Pick<Campaign, 'name' | 'description' | 'activeSourcePackIds'>, dmId: string): Promise<string> {
    if (!dmId) { this.logger.error("Attempted to create campaign without a DM ID."); throw new Error('DM ID required.'); }
    const dataToSave = {
      ...campaignData,
      dmId: dmId,
      playerIds: [],
      characterIds: [],
      activeSourcePackIds: campaignData.activeSourcePackIds || ['srd'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      const docRef = await addDoc(this.campaignsCollection, dataToSave);
      this.logger.log(`Campaign created with ID: ${docRef.id}`);
      return docRef.id;
    } catch (e) {
      this.logger.error(`Error creating campaign for DM ${dmId}`, e instanceof Error ? e.stack : undefined, { campaignName: campaignData.name });
      throw new Error('Failed to create campaign.');
    }
  }

  async loadCampaign(campaignId: string): Promise<Campaign | null> {
    if (!campaignId) { this.logger.warn("loadCampaign called with empty ID."); return null; }
    const campaignDocRef = doc(this.firestore, 'campaigns', campaignId);
    try {
      const docSnap = await getDoc(campaignDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
        } as Campaign;
      } else { this.logger.log(`No campaign found with ID: ${campaignId}`); return null; }
    } catch (e) {
      this.logger.error(`Error loading campaign ${campaignId}`, e instanceof Error ? e.stack : undefined);
      throw new Error(`Failed to load campaign ${campaignId}.`);
    }
  }

  async loadAllCampaigns(userId?: string, userRole?: UserRole): Promise<Campaign[]> {
      if (!userId) { this.logger.warn("loadAllCampaigns called without userId."); return []; }
      const q = query(this.campaignsCollection, or(where('dmId', '==', userId), where('playerIds', 'array-contains', userId)));
      try {
          const querySnapshot = await getDocs(q);
          const campaigns: Campaign[] = [];
          querySnapshot.forEach((docSnap) => {
              const data = docSnap.data();
              campaigns.push({
                  id: docSnap.id,
                  ...data,
                  createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                  updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
              } as Campaign);
          });
          return campaigns;
      } catch (e) {
          this.logger.error(`Error loading campaigns for user ${userId}`, e instanceof Error ? e.stack : undefined, { userRole });
          throw new Error('Failed to load campaigns.');
      }
  }


  async updateCampaign(campaignId: string, campaignData: Partial<Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>>, currentUserId: string): Promise<void> {
    if (!campaignId || !currentUserId) { this.logger.error("updateCampaign missing ID or userId."); throw new Error("Missing parameters."); }
    const campaignDocRef = doc(this.firestore, 'campaigns', campaignId);
    const campaign = await this.loadCampaign(campaignId);
    if (!campaign) { throw new NotFoundException(`Campaign ${campaignId} not found.`); }
    if (campaign.dmId !== currentUserId) { throw new ForbiddenException('Only the DM can update the campaign.'); }
    try {
      await updateDoc(campaignDocRef, { ...campaignData, updatedAt: serverTimestamp() });
      this.logger.log(`Campaign updated: ${campaignId}`);
    } catch (e) {
      this.logger.error(`Error updating campaign ${campaignId}`, e instanceof Error ? e.stack : undefined, { currentUserId, updateKeys: Object.keys(campaignData) });
      throw new Error('Failed to update campaign.');
    }
  }

   async deleteCampaign(campaignId: string, currentUserId: string): Promise<void> {
       if (!campaignId || !currentUserId) { this.logger.error("deleteCampaign missing ID or userId."); throw new Error("Missing parameters."); }
       const campaignDocRef = doc(this.firestore, 'campaigns', campaignId);
       const campaign = await this.loadCampaign(campaignId);
       if (!campaign) { throw new NotFoundException(`Campaign ${campaignId} not found.`); }
       if (campaign.dmId !== currentUserId) { throw new ForbiddenException('Only the DM can delete the campaign.'); }
       try {
           await deleteDoc(campaignDocRef);
           this.logger.log(`Campaign deleted: ${campaignId}`);
       } catch (e) {
           this.logger.error(`Error deleting campaign ${campaignId}`, e instanceof Error ? e.stack : undefined, { currentUserId });
           throw new Error('Failed to delete campaign.');
       }
   }

   async addPlayerToCampaign(campaignId: string, playerId: string, currentUserId: string): Promise<void> {
       if (!campaignId || !playerId || !currentUserId) { this.logger.error("addPlayerToCampaign missing IDs."); throw new Error("Missing parameters."); }
       const campaignDocRef = doc(this.firestore, 'campaigns', campaignId);
       const campaign = await this.loadCampaign(campaignId);
       if (!campaign) { throw new NotFoundException(`Campaign ${campaignId} not found.`); }
       if (campaign.dmId !== currentUserId) { throw new ForbiddenException('Only the DM can add players.'); }
       if (campaign.playerIds.includes(playerId)) { this.logger.log(`Player ${playerId} already in campaign ${campaignId}.`); return; }
       try {
           await updateDoc(campaignDocRef, { playerIds: arrayUnion(playerId), updatedAt: serverTimestamp() });
           this.logger.log(`Player ${playerId} added to campaign ${campaignId}`);
       } catch (e) {
           this.logger.error(`Error adding player ${playerId} to campaign ${campaignId}`, e instanceof Error ? e.stack : undefined, { currentUserId });
           throw new Error('Failed to add player.');
       }
   }

    async removePlayerFromCampaign(campaignId: string, playerId: string, currentUserId: string): Promise<void> {
        if (!campaignId || !playerId || !currentUserId) { this.logger.error("removePlayerFromCampaign missing IDs."); throw new Error("Missing parameters."); }
        const campaignDocRef = doc(this.firestore, 'campaigns', campaignId);
        const campaign = await this.loadCampaign(campaignId);
        if (!campaign) { throw new NotFoundException(`Campaign ${campaignId} not found.`); }
        if (campaign.dmId !== currentUserId) { throw new ForbiddenException('Only the DM can remove players.'); }
        if (!campaign.playerIds.includes(playerId)) { this.logger.log(`Player ${playerId} not found in campaign ${campaignId}.`); return; }
        try {
            await updateDoc(campaignDocRef, { playerIds: arrayRemove(playerId), updatedAt: serverTimestamp() });
            this.logger.log(`Player ${playerId} removed from campaign ${campaignId}`);
        } catch (e) {
            this.logger.error(`Error removing player ${playerId} from campaign ${campaignId}`, e instanceof Error ? e.stack : undefined, { currentUserId });
            throw new Error('Failed to remove player.');
        }
    }

  // --- Game Log Management ---

  async addGameLogEntry(logEntryData: Omit<GameLogEntry, 'id' | 'timestamp'>): Promise<string> {
    if (!logEntryData || !logEntryData.campaignId) { this.logger.error("Invalid log entry data provided."); throw new Error("Invalid log entry data."); }
    try {
      const docRef = await addDoc(this.gameLogsCollection, { ...logEntryData, timestamp: serverTimestamp() });
      return docRef.id;
    } catch (e) {
      this.logger.error(`Error adding game log for campaign ${logEntryData.campaignId}`, e instanceof Error ? e.stack : undefined, { actorId: logEntryData.actorId });
      throw new Error('Failed to add game log entry.');
    }
  }

  async loadGameLogEntries(campaignId: string, limitCount?: number): Promise<GameLogEntry[]> {
    if (!campaignId) { this.logger.warn("loadGameLogEntries called with empty campaignId."); return []; }
    let q = query(this.gameLogsCollection, where('campaignId', '==', campaignId), orderBy('timestamp', 'desc'));
    if (limitCount && limitCount > 0) q = query(q, limit(limitCount));
    try {
      const querySnapshot = await getDocs(q);
      const logEntries: GameLogEntry[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logEntries.push({ id: docSnap.id, ...data, timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date() } as GameLogEntry);
      });
      return logEntries.reverse();
    } catch (e) {
      this.logger.error(`Error loading game log for campaign ${campaignId}`, e instanceof Error ? e.stack : undefined, { limitCount });
      throw new Error('Failed to load game log.');
    }
  }

  // --- Source Pack Management ---

  async saveSourcePack(sourcePackData: Omit<SourcePack, 'createdAt' | 'updatedAt'> & { id?: string }, currentUserId: string): Promise<string> {
      if (!currentUserId) { this.logger.error("User ID required to save source pack."); throw new Error("User ID required."); }
      if (!sourcePackData || !sourcePackData.name) { this.logger.error("Source pack name required."); throw new Error("Source pack name required."); }
      const docRef = sourcePackData.id ? doc(this.firestore, 'sourcePacks', sourcePackData.id) : doc(this.sourcePacksCollection);
      try {
          if (sourcePackData.id) {
              const existingPack = await this.loadSourcePack(sourcePackData.id);
              if (!existingPack) { throw new NotFoundException(`Source pack ${sourcePackData.id} not found.`); }
              if (existingPack.creatorId !== currentUserId && existingPack.creatorId !== 'system') { throw new ForbiddenException('Cannot update this source pack.'); }
          } else if (sourcePackData.creatorId && sourcePackData.creatorId !== currentUserId && sourcePackData.creatorId !== 'system') { throw new ForbiddenException('Cannot create source pack for another user.'); }

          const dataToSave = { ...sourcePackData, creatorId: sourcePackData.creatorId || currentUserId, updatedAt: serverTimestamp(), ...(!sourcePackData.id && { createdAt: serverTimestamp() }) };
          delete dataToSave.id;
          await setDoc(docRef, dataToSave, { merge: true });
          this.logger.log(`Source pack saved with ID: ${docRef.id}`);
          return docRef.id;
      } catch (e) {
          this.logger.error(`Error saving source pack ${sourcePackData.name || 'Unnamed'}`, e instanceof Error ? e.stack : undefined, { packId: sourcePackData.id || 'new', currentUserId });
          if (e instanceof ForbiddenException || e instanceof NotFoundException) throw e;
          throw new Error('Failed to save source pack.');
      }
  }


  async loadSourcePack(sourcePackId: string): Promise<SourcePack | null> {
      if (!sourcePackId) { this.logger.warn("loadSourcePack called with empty ID."); return null; }
      const packDocRef = doc(this.firestore, 'sourcePacks', sourcePackId);
      try {
          const docSnap = await getDoc(packDocRef);
          if (docSnap.exists()) {
              const data = docSnap.data();
              return { id: docSnap.id, ...data, createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(), updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date() } as SourcePack;
          } else { this.logger.log(`No source pack found with ID: ${sourcePackId}`); return null; }
      } catch (e) {
          this.logger.error(`Error loading source pack ${sourcePackId}`, e instanceof Error ? e.stack : undefined);
          return null; // Return null on error to allow graceful fallback in combineContent
      }
  }


  async loadSourcePacksByCreator(creatorId: string): Promise<SourcePack[]> {
       if (!creatorId) { this.logger.warn("loadSourcePacksByCreator called with empty creatorId."); return []; }
       const q = query(this.sourcePacksCollection, where('creatorId', '==', creatorId));
       try {
           const querySnapshot = await getDocs(q);
           const packs: SourcePack[] = [];
           querySnapshot.forEach((docSnap) => {
               const data = docSnap.data();
               packs.push({ id: docSnap.id, ...data, createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(), updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date() } as SourcePack);
           });
           return packs;
       } catch (e) {
           this.logger.error(`Error loading source packs for creator ${creatorId}`, e instanceof Error ? e.stack : undefined);
           throw new Error('Failed to load source packs.');
       }
   }


  async deleteSourcePack(sourcePackId: string, currentUserId: string): Promise<void> {
      if (!sourcePackId || !currentUserId) { this.logger.error("deleteSourcePack missing IDs."); throw new Error("Missing parameters."); }
      const packDocRef = doc(this.firestore, 'sourcePacks', sourcePackId);
      const pack = await this.loadSourcePack(sourcePackId);
      if (!pack) { throw new NotFoundException(`Source pack ${sourcePackId} not found.`); }
      if (pack.creatorId === 'system') { throw new ForbiddenException('Cannot delete system source packs.'); }
      if (pack.creatorId !== currentUserId) { throw new ForbiddenException('Cannot delete this source pack.'); }
      try {
          await deleteDoc(packDocRef);
          this.logger.log(`Source pack deleted: ${sourcePackId}`);
      } catch (e) {
          this.logger.error(`Error deleting source pack ${sourcePackId}`, e instanceof Error ? e.stack : undefined, { currentUserId });
          throw new Error('Failed to delete source pack.');
      }
  }

  // --- Helper to combine content ---
  async getCombinedContentFromPacks(packIds: string[]): Promise<SourcePack['content']> {
    const combinedContent: SourcePack['content'] = { races: {}, classes: {}, items: {}, monsters: {}, npcs: {}, backgrounds: {}, features: {}, spells: {} };
    const packIdsToLoad = packIds?.length > 0 ? [...new Set([...packIds, 'srd'])] : ['srd'];
    this.logger.debug(`Combining content from packs: ${packIdsToLoad.join(', ')}`, 'CampaignService');

    const packPromises = packIdsToLoad.map(id => this.loadSourcePack(id));
    const packs = (await Promise.all(packPromises)).filter((pack): pack is SourcePack => pack !== null);

    const srdPackIndex = packs.findIndex(p => p.id === 'srd');
    const otherPacks = packs.filter(p => p.id !== 'srd');
    const sortedPacks = srdPackIndex > -1 ? [packs[srdPackIndex], ...otherPacks] : otherPacks; // SRD first

    for (const pack of sortedPacks) {
      if (pack?.content) {
        try {
          this.logger.debug(`Merging content from pack: ${pack.id} (${pack.name})`, 'CampaignService');
          combinedContent.races = { ...combinedContent.races, ...pack.content.races };
          combinedContent.classes = { ...combinedContent.classes, ...pack.content.classes };
          combinedContent.items = { ...combinedContent.items, ...pack.content.items };
          combinedContent.monsters = { ...combinedContent.monsters, ...pack.content.monsters };
          combinedContent.npcs = { ...combinedContent.npcs, ...pack.content.npcs };
          combinedContent.backgrounds = { ...combinedContent.backgrounds, ...pack.content.backgrounds };
          combinedContent.features = { ...combinedContent.features, ...pack.content.features };
          combinedContent.spells = { ...combinedContent.spells, ...pack.content.spells };
        } catch (mergeError) {
          this.logger.error(`Error merging content from pack ${pack.id}`, mergeError instanceof Error ? mergeError.stack : undefined, 'CampaignService');
        }
      }
    }
     this.logger.debug('Finished combining content.', 'CampaignService');
    return combinedContent;
  }
}
