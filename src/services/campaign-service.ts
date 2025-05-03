
'use server';

import type { Campaign, GameLogEntry, SourcePack } from '@/lib/types';
import { AppContainer } from '@/nestjs/app-container';
import { CampaignService as NestCampaignService } from '@/nestjs/campaign/campaign.service';
import { logMessage, logError } from '@/services/logging-service';

const getCampaignService = async (): Promise<NestCampaignService> => {
  const container = await AppContainer.getInstance();
  return container.get(NestCampaignService);
};

// --- Campaign Management ---

export async function createCampaign(campaignData: Pick<Campaign, 'name' | 'description' | 'activeSourcePackIds'>, dmId: string): Promise<string> {
  try {
    logMessage('info', `Attempting to create campaign: ${campaignData.name}`, { dmId });
    const service = await getCampaignService();
    const campaignId = await service.createCampaign(campaignData, dmId);
    logMessage('info', `Campaign created successfully: ${campaignId}`, { dmId, campaignName: campaignData.name });
    return campaignId;
  } catch (error) {
    logError(error, { message: `Error creating campaign ${campaignData.name}`, dmId });
    throw new Error(`Failed to create campaign: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function loadCampaign(campaignId: string): Promise<Campaign | null> {
  try {
    logMessage('debug', `Attempting to load campaign: ${campaignId}`);
    const service = await getCampaignService();
    const campaign = await service.loadCampaign(campaignId);
    logMessage('debug', `Campaign ${campaignId} ${campaign ? 'loaded' : 'not found'}.`);
    return campaign;
  } catch (error) {
    logError(error, { message: `Error loading campaign ${campaignId}` });
    return null; // Return null on error, don't throw to client
  }
}

export async function loadAllCampaigns(userId?: string, userRole?: string): Promise<Campaign[]> {
  try {
    logMessage('debug', `Attempting to load campaigns for user: ${userId ?? 'N/A'}`, { userRole });
    if (!userId) {
        logMessage('warn', 'loadAllCampaigns called without userId.');
        return [];
    }
    const service = await getCampaignService();
    // Ensure userRole is passed correctly if the underlying service expects it.
    const campaigns = await service.loadAllCampaigns(userId, userRole as any);
    logMessage('debug', `Loaded ${campaigns.length} campaigns for user: ${userId}`);
    return campaigns;
  } catch (error) {
    logError(error, { message: `Error loading campaigns for user ${userId ?? 'N/A'}`, userRole });
    return []; // Return empty on error
  }
}

export async function updateCampaign(campaignId: string, campaignData: Partial<Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>>, currentUserId: string): Promise<void> {
   try {
    logMessage('info', `Attempting to update campaign: ${campaignId}`, { currentUserId, updateKeys: Object.keys(campaignData) });
    const service = await getCampaignService();
    await service.updateCampaign(campaignId, campaignData, currentUserId);
    logMessage('info', `Campaign updated successfully: ${campaignId}`, { currentUserId });
  } catch (error) {
    logError(error, { message: `Error updating campaign ${campaignId}`, currentUserId });
    throw new Error(`Failed to update campaign: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deleteCampaign(campaignId: string, currentUserId: string): Promise<void> {
  try {
    logMessage('info', `Attempting to delete campaign: ${campaignId}`, { currentUserId });
    const service = await getCampaignService();
    await service.deleteCampaign(campaignId, currentUserId);
    logMessage('info', `Campaign deleted successfully: ${campaignId}`, { currentUserId });
  } catch (error) {
    logError(error, { message: `Error deleting campaign ${campaignId}`, currentUserId });
    throw new Error(`Failed to delete campaign: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function addPlayerToCampaign(campaignId: string, playerId: string, currentUserId: string): Promise<void> {
   try {
    logMessage('info', `Attempting to add player ${playerId} to campaign: ${campaignId}`, { currentUserId });
    const service = await getCampaignService();
    await service.addPlayerToCampaign(campaignId, playerId, currentUserId);
    logMessage('info', `Player ${playerId} added to campaign ${campaignId} successfully`, { currentUserId });
  } catch (error) {
    logError(error, { message: `Error adding player ${playerId} to campaign ${campaignId}`, currentUserId });
    throw new Error(`Failed to add player: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function removePlayerFromCampaign(campaignId: string, playerId: string, currentUserId: string): Promise<void> {
   try {
    logMessage('info', `Attempting to remove player ${playerId} from campaign: ${campaignId}`, { currentUserId });
    const service = await getCampaignService();
    await service.removePlayerFromCampaign(campaignId, playerId, currentUserId);
    logMessage('info', `Player ${playerId} removed from campaign ${campaignId} successfully`, { currentUserId });
  } catch (error) {
    logError(error, { message: `Error removing player ${playerId} from campaign ${campaignId}`, currentUserId });
    throw new Error(`Failed to remove player: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- Game Log Management ---

export async function addGameLogEntry(logEntryData: Omit<GameLogEntry, 'id' | 'timestamp'>): Promise<string> {
  try {
    // Log entry is typically low-level, might not need separate info log unless debugging
    const service = await getCampaignService();
    const entryId = await service.addGameLogEntry(logEntryData);
    return entryId;
  } catch (error) {
    logError(error, { message: `Error adding game log entry to campaign ${logEntryData.campaignId}`, actorId: logEntryData.actorId });
    throw new Error(`Failed to add game log entry: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function loadGameLogEntries(campaignId: string, limitCount?: number): Promise<GameLogEntry[]> {
  try {
    logMessage('debug', `Attempting to load game log entries for campaign: ${campaignId}`, { limitCount });
    const service = await getCampaignService();
    const entries = await service.loadGameLogEntries(campaignId, limitCount);
    logMessage('debug', `Loaded ${entries.length} game log entries for campaign: ${campaignId}`);
    return entries;
  } catch (error) {
    logError(error, { message: `Error loading game log entries for campaign ${campaignId}`, limitCount });
    return []; // Return empty on error
  }
}

// --- Source Pack Management ---

export async function saveSourcePack(sourcePackData: Omit<SourcePack, 'createdAt' | 'updatedAt'> & { id?: string }, currentUserId: string): Promise<string> {
  try {
    logMessage('info', `Attempting to save source pack: ${sourcePackData.name || sourcePackData.id || 'New Pack'}`, { currentUserId });
    const service = await getCampaignService();
    const packId = await service.saveSourcePack(sourcePackData, currentUserId);
    logMessage('info', `Source pack saved successfully: ${packId}`, { currentUserId, packName: sourcePackData.name });
    return packId;
  } catch (error) {
    logError(error, { message: `Error saving source pack ${sourcePackData.name || sourcePackData.id || 'New Pack'}`, currentUserId });
    throw new Error(`Failed to save source pack: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function loadSourcePack(sourcePackId: string): Promise<SourcePack | null> {
  try {
    logMessage('debug', `Attempting to load source pack: ${sourcePackId}`);
    const service = await getCampaignService();
    const pack = await service.loadSourcePack(sourcePackId);
    logMessage('debug', `Source pack ${sourcePackId} ${pack ? 'loaded' : 'not found'}.`);
    return pack;
  } catch (error) {
    logError(error, { message: `Error loading source pack ${sourcePackId}` });
    return null;
  }
}

export async function loadSourcePacksByCreator(creatorId: string): Promise<SourcePack[]> {
  try {
    logMessage('debug', `Attempting to load source packs for creator: ${creatorId}`);
    const service = await getCampaignService();
    const packs = await service.loadSourcePacksByCreator(creatorId);
    logMessage('debug', `Loaded ${packs.length} source packs for creator: ${creatorId}`);
    return packs;
  } catch (error) {
    logError(error, { message: `Error loading source packs for creator ${creatorId}` });
    return [];
  }
}

export async function deleteSourcePack(sourcePackId: string, currentUserId: string): Promise<void> {
  try {
    logMessage('info', `Attempting to delete source pack: ${sourcePackId}`, { currentUserId });
    const service = await getCampaignService();
    await service.deleteSourcePack(sourcePackId, currentUserId);
    logMessage('info', `Source pack deleted successfully: ${sourcePackId}`, { currentUserId });
  } catch (error) {
    logError(error, { message: `Error deleting source pack ${sourcePackId}`, currentUserId });
    throw new Error(`Failed to delete source pack: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- Helper ---
export async function getCombinedContentFromPacks(packIds: string[]): Promise<SourcePack['content']> {
    try {
        logMessage('debug', `Attempting to get combined content from packs: ${packIds.join(', ')}`);
        const service = await getCampaignService();
        const content = await service.getCombinedContentFromPacks(packIds);
        logMessage('debug', `Successfully combined content from packs: ${packIds.join(', ')}`);
        return content;
    } catch (error) {
        logError(error, { message: `Error combining content from packs`, packIds });
        // Attempt to return at least SRD content as a fallback
        try {
            const service = await getCampaignService();
            return await service.getCombinedContentFromPacks(['srd']);
        } catch (srdError) {
             logError(srdError, { message: 'Error loading fallback SRD content' });
             return { races: {}, classes: {}, items: {}, monsters: {}, npcs: {}, backgrounds: {}, features: {}, spells: {} };
        }
    }
}
