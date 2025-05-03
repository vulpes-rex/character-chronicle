
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CollectionReference, Firestore, Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { Encounter } from '@character-chronicle/shared/types'; // Use shared library path
import { LoggingService } from '../logging/logging.module'; // Updated path
import { CampaignService } from '../campaign/campaign.service'; // Updated path
import { EncounterRepository } from '../repositories/encounter.repository';

@Injectable()
export class EncounterService {

  constructor(
    private readonly encounterRepository: EncounterRepository,
    private readonly logger: LoggingService,
    private readonly campaignService: CampaignService, // Still need for permission checks
  ) {
    this.logger.setContext('EncounterService');
  }

  /** Saves a new encounter or updates an existing one. */
  async saveEncounter(encounterData: Omit<Encounter, 'createdAt' | 'updatedAt'> & { id?: string }, dmUserId: string): Promise<string> {
    if (!encounterData.campaignId) { this.logger.error("saveEncounter missing campaignId."); throw new Error('Campaign ID required.'); }
    if (!dmUserId) { this.logger.error("saveEncounter missing dmUserId."); throw new Error('DM User ID required.'); }

    const campaign = await this.campaignService.loadCampaign(encounterData.campaignId);
    if (!campaign) { throw new NotFoundException(`Campaign ${encounterData.campaignId} not found.`); }
    if (campaign.dmId !== dmUserId) { throw new ForbiddenException('Only the campaign DM can save encounters.'); }

    const dataToSave: Omit<Encounter, 'id' | 'createdAt' | 'updatedAt'> = {
        name: encounterData.name,
        description: encounterData.description,
        campaignId: encounterData.campaignId,
        participants: encounterData.participants || [],
        status: encounterData.status || 'setup',
        currentTurnIndex: encounterData.currentTurnIndex,
        round: encounterData.round,
    };

    try {
        let encounterId: string;
        if (encounterData.id) {
            await this.encounterRepository.update(encounterData.id, dataToSave);
            encounterId = encounterData.id;
            this.logger.log(`Encounter updated: ${encounterId}`);
        } else {
             // Repository's create will handle timestamps
            encounterId = await this.encounterRepository.create(dataToSave as any);
            this.logger.log(`Encounter created: ${encounterId}`);
        }
        return encounterId;
    } catch (e) {
      this.logger.error(`Error saving encounter ${encounterData.name || 'Unnamed'}`, e instanceof Error ? e.stack : undefined, { encounterId: encounterData.id || 'new', dmUserId });
      throw new Error('Failed to save encounter.');
    }
  }

  /** Loads a specific encounter from Firestore. */
  async loadEncounter(encounterId: string): Promise<Encounter | null> {
    if (!encounterId) { this.logger.warn("loadEncounter called with empty ID."); return null; }
    try {
        const encounter = await this.encounterRepository.findById(encounterId);
        if (!encounter) {
            this.logger.log(`No encounter found with ID: ${encounterId}`);
        }
        return encounter;
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

    try {
      const encounters = await this.encounterRepository.findByCampaignIds(campaignIds);
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
    const encounter = await this.loadEncounter(encounterId);
    if (!encounter) { throw new NotFoundException(`Encounter ${encounterId} not found.`); }

    const campaign = await this.campaignService.loadCampaign(encounter.campaignId);
    if (!campaign) { throw new NotFoundException(`Campaign ${encounter.campaignId} for encounter ${encounterId} not found.`); }
    if (campaign.dmId !== dmUserId) { throw new ForbiddenException('Only the campaign DM can delete this encounter.'); }

    try {
      await this.encounterRepository.delete(encounterId);
      this.logger.log(`Encounter deleted: ${encounterId}`);
    } catch (e) {
      this.logger.error(`Error deleting encounter ${encounterId}`, e instanceof Error ? e.stack : undefined, { dmUserId });
      throw new Error(`Failed to delete encounter ${encounterId}.`);
    }
  }
}
