
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CollectionReference, Firestore, Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { Encounter } from '@character-chronicle/shared/types'; // Use shared library path
import { LoggingService } from '../logging/logging.service'; // Updated path
import { CampaignService } from '../campaign/campaign.service'; // Updated path

@Injectable()
export class EncounterService {
  private readonly encountersCollection: CollectionReference<Omit<Encounter, 'id'>>;

  constructor(
    @Inject('FIRESTORE') private readonly firestore: Firestore,
    private readonly logger: LoggingService,
    private readonly campaignService: CampaignService, // Inject CampaignService
  ) {
    this.encountersCollection = collection(this.firestore, 'encounters') as CollectionReference<Omit<Encounter, 'id'>>;
    this.logger.setContext('EncounterService');
  }

  /** Saves a new encounter or updates an existing one. */
  async saveEncounter(encounterData: Omit<Encounter, 'createdAt' | 'updatedAt'> & { id?: string }, dmUserId: string): Promise<string> {
    if (!encounterData.campaignId) { this.logger.error("saveEncounter missing campaignId."); throw new Error('Campaign ID required.'); }
    if (!dmUserId) { this.logger.error("saveEncounter missing dmUserId."); throw new Error('DM User ID required.'); }

    const campaign = await this.campaignService.loadCampaign(encounterData.campaignId);
    if (!campaign) { throw new NotFoundException(`Campaign ${encounterData.campaignId} not found.`); }
    if (campaign.dmId !== dmUserId) { throw new ForbiddenException('Only the campaign DM can save encounters.'); }

    const docRef = encounterData.id ? doc(this.firestore, 'encounters', encounterData.id) : doc(this.encountersCollection);
    const dataToSave = { ...encounterData, updatedAt: serverTimestamp(), ...(!encounterData.id && { createdAt: serverTimestamp() }) };
    delete dataToSave.id;

    try {
      await setDoc(docRef, dataToSave, { merge: true });
      this.logger.log(`Encounter saved with ID: ${docRef.id}`);
      return docRef.id;
    } catch (e) {
      this.logger.error(`Error saving encounter ${encounterData.name || 'Unnamed'}`, e instanceof Error ? e.stack : undefined, { encounterId: docRef.id, dmUserId });
      throw new Error('Failed to save encounter.');
    }
  }

  /** Loads a specific encounter from Firestore. */
  async loadEncounter(encounterId: string): Promise<Encounter | null> {
    if (!encounterId) { this.logger.warn("loadEncounter called with empty ID."); return null; }
    const encounterDocRef = doc(this.firestore, 'encounters', encounterId);
    try {
      const docSnap = await getDoc(encounterDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return { id: docSnap.id, ...data, createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(), updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date() } as Encounter;
      } else { this.logger.log(`No encounter found with ID: ${encounterId}`); return null; }
    } catch (e) {
      this.logger.error(`Error loading encounter ${encounterId}`, e instanceof Error ? e.stack : undefined);
      throw new Error(`Failed to load encounter ${encounterId}.`);
    }
  }

  /** Loads all encounters associated with campaigns run by a specific DM. */
  async loadAllEncounters(dmUserId: string): Promise<Encounter[]> {
    if (!dmUserId) { this.logger.warn("loadAllEncounters called with empty dmUserId."); return []; }
    let campaignIds: string[] = [];
    try {
      const campaigns = await this.campaignService.loadAllCampaigns(dmUserId, 'dm'); // Use injected service
      campaignIds = campaigns.map(c => c.id);
    } catch (error) {
        this.logger.error(`Failed loading campaigns for DM ${dmUserId} in loadAllEncounters`, error instanceof Error ? error.stack : undefined);
        throw new Error(`Failed to load campaigns for DM.`);
    }
    if (campaignIds.length === 0) { this.logger.log(`No campaigns found for DM ${dmUserId}.`); return []; }
    if (campaignIds.length > 30) { this.logger.warn(`Querying encounters for >30 campaigns for DM ${dmUserId}, may be incomplete.`); campaignIds = campaignIds.slice(0, 30); }
    if (campaignIds.length === 0) return [];

    const encountersQuery = query(this.encountersCollection, where('campaignId', 'in', campaignIds));
    try {
      const querySnapshot = await getDocs(encountersQuery);
      const encounters: Encounter[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        encounters.push({ id: docSnap.id, ...data, createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(), updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date() } as Encounter);
      });
      encounters.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
      return encounters;
    } catch (e) {
      this.logger.error(`Error loading encounters for DM ${dmUserId}`, e instanceof Error ? e.stack : undefined, { queriedCampaignIds: campaignIds });
      throw new Error('Failed to load encounters.');
    }
  }

  /** Deletes an encounter. */
  async deleteEncounter(encounterId: string, dmUserId: string): Promise<void> {
    if (!encounterId || !dmUserId) { this.logger.error("deleteEncounter missing IDs."); throw new Error("Missing parameters."); }
    const encounterDocRef = doc(this.firestore, 'encounters', encounterId);
    const encounter = await this.loadEncounter(encounterId);
    if (!encounter) { throw new NotFoundException(`Encounter ${encounterId} not found.`); }

    const campaign = await this.campaignService.loadCampaign(encounter.campaignId);
    if (!campaign) { throw new NotFoundException(`Campaign ${encounter.campaignId} for encounter ${encounterId} not found.`); }
    if (campaign.dmId !== dmUserId) { throw new ForbiddenException('Only the campaign DM can delete this encounter.'); }

    try {
      await deleteDoc(encounterDocRef);
      this.logger.log(`Encounter deleted: ${encounterId}`);
    } catch (e) {
      this.logger.error(`Error deleting encounter ${encounterId}`, e instanceof Error ? e.stack : undefined, { dmUserId });
      throw new Error(`Failed to delete encounter ${encounterId}.`);
    }
  }
}
