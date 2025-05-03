'use server';

/**
 * @fileOverview Server Actions for campaign management.
 * These actions bridge the Next.js frontend with the NestJS backend services.
 */

import { AppContainer } from '@/nestjs/app-container';
import { CampaignService } from '@/nestjs/campaign/campaign.service';
import { logMessage, logError } from '@/services/logging-service';
import type { Campaign, GameLogEntry, SourcePack } from '@/lib/types'; // Use frontend alias

// Helper function to get the CampaignService instance
const getCampaignService = async (): Promise<CampaignService> => {
  const container = await AppContainer.getInstance();
  return container.get(CampaignService);
};

// --- Campaign Management ---

export async function createCampaignAction(campaignData: Pick<Campaign, 'name' | 'description' | 'activeSourcePackIds'>, dmId: string): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to create campaign: ${campaignData.name}`, { dmId });
    const campaignService = await getCampaignService();
    const campaignId = await campaignService.createCampaign(campaignData, dmId);
    logMessage('info', `[Action] Campaign created successfully: ${campaignId}`, { dmId, campaignName: campaignData.name });
    return { success: true, campaignId };
  } catch (error) {
    logError(error, { message: `[Action] Error creating campaign ${campaignData.name}`, dmId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create campaign.' };
  }
}

export async function loadCampaignAction(campaignId: string): Promise<{ success: boolean; campaign?: Campaign | null; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load campaign: ${campaignId}`);
    const campaignService = await getCampaignService();
    const campaign = await campaignService.loadCampaign(campaignId);
    logMessage('debug', `[Action] Campaign ${campaignId} ${campaign ? 'loaded' : 'not found'}.`);
    return { success: true, campaign };
  } catch (error) {
    logError(error, { message: `[Action] Error loading campaign ${campaignId}` });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load campaign.' };
  }
}

export async function loadAllCampaignsAction(userId?: string, userRole?: string): Promise<{ success: boolean; campaigns: Campaign[]; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load campaigns for user: ${userId ?? 'N/A'}`, { userRole });
    if (!userId) {
        logMessage('warn', '[Action] loadAllCampaignsAction called without userId.');
        return { success: true, campaigns: [] }; // Return success with empty array if no user ID
    }
    const campaignService = await getCampaignService();
    // Assuming loadAllCampaigns takes userId and optionally role (adjust if API differs)
    const campaigns = await campaignService.loadAllCampaigns(userId, userRole as any); // Cast role if needed by service
    logMessage('debug', `[Action] Loaded ${campaigns.length} campaigns for user: ${userId}`);
    return { success: true, campaigns };
  } catch (error) {
    logError(error, { message: `[Action] Error loading campaigns for user ${userId ?? 'N/A'}`, userRole });
    return { success: false, campaigns: [], error: error instanceof Error ? error.message : 'Failed to load campaigns.' };
  }
}

export async function updateCampaignAction(campaignId: string, campaignData: Partial<Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>>, currentUserId: string): Promise<{ success: boolean; error?: string }> {
   try {
    logMessage('info', `[Action] Attempting to update campaign: ${campaignId}`, { currentUserId, updateKeys: Object.keys(campaignData) });
    const campaignService = await getCampaignService();
    await campaignService.updateCampaign(campaignId, campaignData, currentUserId);
    logMessage('info', `[Action] Campaign updated successfully: ${campaignId}`, { currentUserId });
    return { success: true };
  } catch (error) {
    logError(error, { message: `[Action] Error updating campaign ${campaignId}`, currentUserId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update campaign.' };
  }
}

export async function deleteCampaignAction(campaignId: string, currentUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to delete campaign: ${campaignId}`, { currentUserId });
    const campaignService = await getCampaignService();
    await campaignService.deleteCampaign(campaignId, currentUserId);
    logMessage('info', `[Action] Campaign deleted successfully: ${campaignId}`, { currentUserId });
    return { success: true };
  } catch (error) {
    logError(error, { message: `[Action] Error deleting campaign ${campaignId}`, currentUserId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete campaign.' };
  }
}

export async function addPlayerToCampaignAction(campaignId: string, playerId: string, currentUserId: string): Promise<{ success: boolean; error?: string }> {
   try {
    logMessage('info', `[Action] Attempting to add player ${playerId} to campaign: ${campaignId}`, { currentUserId });
    const campaignService = await getCampaignService();
    await campaignService.addPlayerToCampaign(campaignId, playerId, currentUserId);
    logMessage('info', `[Action] Player ${playerId} added to campaign ${campaignId} successfully`, { currentUserId });
    return { success: true };
  } catch (error) {
    logError(error, { message: `[Action] Error adding player ${playerId} to campaign ${campaignId}`, currentUserId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add player.' };
  }
}

export async function removePlayerFromCampaignAction(campaignId: string, playerId: string, currentUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
        logMessage('info', `[Action] Attempting to remove player ${playerId} from campaign: ${campaignId}`, { currentUserId });
        const campaignService = await getCampaignService();
        await campaignService.removePlayerFromCampaign(campaignId, playerId, currentUserId);
        logMessage('info', `[Action] Player ${playerId} removed from campaign ${campaignId} successfully`, { currentUserId });
        return { success: true };
    } catch (error) {
        logError(error, { message: `[Action] Error removing player ${playerId} from campaign ${campaignId}`, currentUserId });
        return { success: false, error: error instanceof Error ? error.message : 'Failed to remove player.' };
    }
}

// --- Game Log Management ---

export async function addGameLogEntryAction(logEntryData: Omit<GameLogEntry, 'id' | 'timestamp'>): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    const campaignService = await getCampaignService();
    const entryId = await campaignService.addGameLogEntry(logEntryData);
    return { success: true, entryId };
  } catch (error) {
    logError(error, { message: `[Action] Error adding game log entry to campaign ${logEntryData.campaignId}`, actorId: logEntryData.actorId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add game log entry.' };
  }
}

export async function loadGameLogEntriesAction(campaignId: string, limitCount?: number): Promise<{ success: boolean; entries: GameLogEntry[]; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load game log entries for campaign: ${campaignId}`, { limitCount });
    const campaignService = await getCampaignService();
    const entries = await campaignService.loadGameLogEntries(campaignId, limitCount);
    logMessage('debug', `[Action] Loaded ${entries.length} game log entries for campaign: ${campaignId}`);
    return { success: true, entries };
  } catch (error) {
    logError(error, { message: `[Action] Error loading game log entries for campaign ${campaignId}`, limitCount });
    return { success: false, entries: [], error: error instanceof Error ? error.message : 'Failed to load game log entries.' };
  }
}

// --- Source Pack Management ---

export async function saveSourcePackAction(sourcePackData: Omit<SourcePack, 'createdAt' | 'updatedAt'> & { id?: string }, currentUserId: string): Promise<{ success: boolean; packId?: string; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to save source pack: ${sourcePackData.name || sourcePackData.id || 'New Pack'}`, { currentUserId });
    const campaignService = await getCampaignService();
    const packId = await campaignService.saveSourcePack(sourcePackData, currentUserId);
    logMessage('info', `[Action] Source pack saved successfully: ${packId}`, { currentUserId, packName: sourcePackData.name });
    return { success: true, packId };
  } catch (error) {
    logError(error, { message: `[Action] Error saving source pack ${sourcePackData.name || sourcePackData.id || 'New Pack'}`, currentUserId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save source pack.' };
  }
}

export async function loadSourcePackAction(sourcePackId: string): Promise<{ success: boolean; pack?: SourcePack | null; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load source pack: ${sourcePackId}`);
    const campaignService = await getCampaignService();
    const pack = await campaignService.loadSourcePack(sourcePackId);
    logMessage('debug', `[Action] Source pack ${sourcePackId} ${pack ? 'loaded' : 'not found'}.`);
    return { success: true, pack };
  } catch (error) {
    logError(error, { message: `[Action] Error loading source pack ${sourcePackId}` });
     return { success: false, error: error instanceof Error ? error.message : 'Failed to load source pack.' };
  }
}

export async function loadSourcePacksByCreatorAction(creatorId: string): Promise<{ success: boolean; packs: SourcePack[]; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load source packs for creator: ${creatorId}`);
    const campaignService = await getCampaignService();
    const packs = await campaignService.loadSourcePacksByCreator(creatorId);
    logMessage('debug', `[Action] Loaded ${packs.length} source packs for creator: ${creatorId}`);
    return { success: true, packs };
  } catch (error) {
    logError(error, { message: `[Action] Error loading source packs for creator ${creatorId}` });
    return { success: false, packs: [], error: error instanceof Error ? error.message : 'Failed to load source packs.' };
  }
}

export async function deleteSourcePackAction(sourcePackId: string, currentUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to delete source pack: ${sourcePackId}`, { currentUserId });
    const campaignService = await getCampaignService();
    await campaignService.deleteSourcePack(sourcePackId, currentUserId);
    logMessage('info', `[Action] Source pack deleted successfully: ${sourcePackId}`, { currentUserId });
    return { success: true };
  } catch (error) {
    logError(error, { message: `[Action] Error deleting source pack ${sourcePackId}`, currentUserId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete source pack.' };
  }
}

// --- Combined Content ---
export async function getCombinedContentFromPacksAction(packIds: string[]): Promise<{ success: boolean; content?: SourcePack['content']; error?: string }> {
    try {
        logMessage('debug', `[Action] Attempting to get combined content from packs: ${packIds.join(', ')}`);
        const campaignService = await getCampaignService();
        const content = await campaignService.getCombinedContentFromPacks(packIds);
        logMessage('debug', `[Action] Successfully combined content from packs: ${packIds.join(', ')}`);
        return { success: true, content };
    } catch (error) {
        logError(error, { message: `[Action] Error combining content from packs`, packIds });
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get combined content.' };
    }
}

    