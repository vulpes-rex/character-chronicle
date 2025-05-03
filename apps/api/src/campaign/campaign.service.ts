
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CollectionReference, Firestore, Timestamp, addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, or, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import type { Campaign, GameLogEntry, SourcePack, UserRole, Monster, NPC } from '@character-chronicle/shared/types'; // Use shared library path
import { LoggingService } from '../logging/logging.service'; // Updated path
import { CampaignRepository } from '../repositories/campaign.repository';
import { GameLogRepository } from '../repositories/game-log.repository';
import { SourcePackRepository } from '../repositories/source-pack.repository';
import { SRD_SOURCE_PACK } from '@character-chronicle/shared/data'; // Use shared library path

@Injectable()
export class CampaignService {

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly gameLogRepository: GameLogRepository,
    private readonly sourcePackRepository: SourcePackRepository,
    private readonly logger: LoggingService,
  ) {
    this.logger.setContext('CampaignService');
  }

  // --- Campaign Management ---

  async createCampaign(campaignData: Pick<Campaign, 'name' | 'description' | 'activeSourcePackIds'>, dmId: string): Promise<string> {
    if (!dmId) { this.logger.error("Attempted to create campaign without a DM ID."); throw new Error('DM ID required.'); }
    const dataToSave: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'> = {
      ...campaignData,
      dmId: dmId,
      playerIds: [],
      characterIds: [],
      activeSourcePackIds: campaignData.activeSourcePackIds || ['srd'],
    };
    try {
      const campaignId = await this.campaignRepository.create(dataToSave as any); // Cast needed due to missing createdAt/updatedAt
      this.logger.log(`Campaign created with ID: ${campaignId}`);
      return campaignId;
    } catch (e) {
      this.logger.error(`Error creating campaign for DM ${dmId}`, e instanceof Error ? e.stack : undefined, { campaignName: campaignData.name });
      throw new Error('Failed to create campaign.');
    }
  }

  async loadCampaign(campaignId: string): Promise<Campaign | null> {
    if (!campaignId) { this.logger.warn("loadCampaign called with empty ID."); return null; }
    try {
        const campaign = await this.campaignRepository.findById(campaignId);
         if (!campaign) {
            this.logger.log(`No campaign found with ID: ${campaignId}`);
         }
        return campaign;
    } catch (e) {
        this.logger.error(`Error loading campaign ${campaignId}`, e instanceof Error ? e.stack : undefined);
        throw new Error(`Failed to load campaign ${campaignId}.`);
    }
  }

  async loadAllCampaigns(userId?: string, userRole?: UserRole): Promise<Campaign[]> {
      if (!userId) { this.logger.warn("loadAllCampaigns called without userId."); return []; }
      try {
          // Use findAll with appropriate constraints
          const campaigns = await this.campaignRepository.findAll([
              or(where('dmId', '==', userId), where('playerIds', 'array-contains', userId))
          ]);
          return campaigns;
      } catch (e) {
          this.logger.error(`Error loading campaigns for user ${userId}`, e instanceof Error ? e.stack : undefined, { userRole });
          throw new Error('Failed to load campaigns.');
      }
  }


  async updateCampaign(campaignId: string, campaignData: Partial<Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>>, currentUserId: string): Promise<void> {
    if (!campaignId || !currentUserId) { this.logger.error("updateCampaign missing ID or userId."); throw new Error("Missing parameters."); }
    const campaign = await this.loadCampaign(campaignId);
    if (!campaign) { throw new NotFoundException(`Campaign ${campaignId} not found.`); }
    if (campaign.dmId !== currentUserId) { throw new ForbiddenException('Only the DM can update the campaign.'); }
    try {
      await this.campaignRepository.update(campaignId, campaignData);
      this.logger.log(`Campaign updated: ${campaignId}`);
    } catch (e) {
      this.logger.error(`Error updating campaign ${campaignId}`, e instanceof Error ? e.stack : undefined, { currentUserId, updateKeys: Object.keys(campaignData) });
      throw new Error('Failed to update campaign.');
    }
  }

   async deleteCampaign(campaignId: string, currentUserId: string): Promise<void> {
       if (!campaignId || !currentUserId) { this.logger.error("deleteCampaign missing ID or userId."); throw new Error("Missing parameters."); }
       const campaign = await this.loadCampaign(campaignId);
       if (!campaign) { throw new NotFoundException(`Campaign ${campaignId} not found.`); }
       if (campaign.dmId !== currentUserId) { throw new ForbiddenException('Only the DM can delete the campaign.'); }
       try {
           await this.campaignRepository.delete(campaignId);
           this.logger.log(`Campaign deleted: ${campaignId}`);
       } catch (e) {
           this.logger.error(`Error deleting campaign ${campaignId}`, e instanceof Error ? e.stack : undefined, { currentUserId });
           throw new Error('Failed to delete campaign.');
       }
   }

   async addPlayerToCampaign(campaignId: string, playerId: string, currentUserId: string): Promise<void> {
       if (!campaignId || !playerId || !currentUserId) { this.logger.error("addPlayerToCampaign missing IDs."); throw new Error("Missing parameters."); }
       const campaign = await this.loadCampaign(campaignId);
       if (!campaign) { throw new NotFoundException(`Campaign ${campaignId} not found.`); }
       if (campaign.dmId !== currentUserId) { throw new ForbiddenException('Only the DM can add players.'); }
       if (campaign.playerIds.includes(playerId)) { this.logger.log(`Player ${playerId} already in campaign ${campaignId}.`); return; }
       try {
           // Use arrayUnion within the update operation
           await this.campaignRepository.update(campaignId, { playerIds: arrayUnion(playerId) as any }); // Firestore specific update
           this.logger.log(`Player ${playerId} added to campaign ${campaignId}`);
       } catch (e) {
           this.logger.error(`Error adding player ${playerId} to campaign ${campaignId}`, e instanceof Error ? e.stack : undefined, { currentUserId });
           throw new Error('Failed to add player.');
       }
   }

    async removePlayerFromCampaign(campaignId: string, playerId: string, currentUserId: string): Promise<void> {
        if (!campaignId || !playerId || !currentUserId) { this.logger.error("removePlayerFromCampaign missing IDs."); throw new Error("Missing parameters."); }
        const campaign = await this.loadCampaign(campaignId);
        if (!campaign) { throw new NotFoundException(`Campaign ${campaignId} not found.`); }
        if (campaign.dmId !== currentUserId) { throw new ForbiddenException('Only the DM can remove players.'); }
        if (!campaign.playerIds.includes(playerId)) { this.logger.log(`Player ${playerId} not found in campaign ${campaignId}.`); return; }
        try {
             // Use arrayRemove within the update operation
             await this.campaignRepository.update(campaignId, { playerIds: arrayRemove(playerId) as any }); // Firestore specific update
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
      // Repository's create will handle timestamps
      const entryId = await this.gameLogRepository.create(logEntryData as any);
      return entryId;
    } catch (e) {
      this.logger.error(`Error adding game log for campaign ${logEntryData.campaignId}`, e instanceof Error ? e.stack : undefined, { actorId: logEntryData.actorId });
      throw new Error('Failed to add game log entry.');
    }
  }

  async loadGameLogEntries(campaignId: string, limitCount?: number): Promise<GameLogEntry[]> {
    if (!campaignId) { this.logger.warn("loadGameLogEntries called with empty campaignId."); return []; }
    try {
      return await this.gameLogRepository.findByCampaignId(campaignId, limitCount);
    } catch (e) {
      this.logger.error(`Error loading game log for campaign ${campaignId}`, e instanceof Error ? e.stack : undefined, { limitCount });
      throw new Error('Failed to load game log.');
    }
  }

  // --- Source Pack Management ---

  async saveSourcePack(sourcePackData: Omit<SourcePack, 'createdAt' | 'updatedAt'> & { id?: string }, currentUserId: string): Promise<string> {
      if (!currentUserId) { this.logger.error("User ID required to save source pack."); throw new Error("User ID required."); }
      if (!sourcePackData || !sourcePackData.name) { this.logger.error("Source pack name required."); throw new Error("Source pack name required."); }

      try {
          const dataToSave: Omit<SourcePack, 'id' | 'createdAt' | 'updatedAt'> = {
              ...sourcePackData,
              creatorId: sourcePackData.creatorId || currentUserId,
              // Content is part of sourcePackData
          };

          if (sourcePackData.id) {
              // Update existing pack - permission check first
              const existingPack = await this.sourcePackRepository.findById(sourcePackData.id);
              if (!existingPack) { throw new NotFoundException(`Source pack ${sourcePackData.id} not found.`); }
              if (existingPack.creatorId !== currentUserId && existingPack.creatorId !== 'system') { throw new ForbiddenException('Cannot update this source pack.'); }
              await this.sourcePackRepository.update(sourcePackData.id, dataToSave);
              this.logger.log(`Source pack updated: ${sourcePackData.id}`);
              return sourcePackData.id;
          } else {
              // Create new pack
               if (sourcePackData.creatorId && sourcePackData.creatorId !== currentUserId && sourcePackData.creatorId !== 'system') { throw new ForbiddenException('Cannot create source pack for another user.'); }
              const packId = await this.sourcePackRepository.create(dataToSave as any);
              this.logger.log(`Source pack created: ${packId}`);
              return packId;
          }
      } catch (e) {
          this.logger.error(`Error saving source pack ${sourcePackData.name || 'Unnamed'}`, e instanceof Error ? e.stack : undefined, { packId: sourcePackData.id || 'new', currentUserId });
          if (e instanceof ForbiddenException || e instanceof NotFoundException) throw e;
          throw new Error('Failed to save source pack.');
      }
  }

  async loadSourcePack(sourcePackId: string): Promise<SourcePack | null> {
      if (!sourcePackId) { this.logger.warn("loadSourcePack called with empty ID."); return null; }
      try {
        const pack = await this.sourcePackRepository.findById(sourcePackId);
         if (!pack) {
            this.logger.log(`No source pack found with ID: ${sourcePackId}`);
         }
        return pack;
      } catch (e) {
          this.logger.error(`Error loading source pack ${sourcePackId}`, e instanceof Error ? e.stack : undefined);
          return null; // Return null on error to allow graceful fallback
      }
  }

  async loadSourcePacksByCreator(creatorId: string): Promise<SourcePack[]> {
       if (!creatorId) { this.logger.warn("loadSourcePacksByCreator called with empty creatorId."); return []; }
       try {
           return await this.sourcePackRepository.findByCreatorId(creatorId);
       } catch (e) {
           this.logger.error(`Error loading source packs for creator ${creatorId}`, e instanceof Error ? e.stack : undefined);
           throw new Error('Failed to load source packs.');
       }
   }

  async deleteSourcePack(sourcePackId: string, currentUserId: string): Promise<void> {
      if (!sourcePackId || !currentUserId) { this.logger.error("deleteSourcePack missing IDs."); throw new Error("Missing parameters."); }
      const pack = await this.loadSourcePack(sourcePackId);
      if (!pack) { throw new NotFoundException(`Source pack ${sourcePackId} not found.`); }
      if (pack.creatorId === 'system') { throw new ForbiddenException('Cannot delete system source packs.'); }
      if (pack.creatorId !== currentUserId) { throw new ForbiddenException('Cannot delete this source pack.'); }
      try {
          await this.sourcePackRepository.delete(sourcePackId);
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
