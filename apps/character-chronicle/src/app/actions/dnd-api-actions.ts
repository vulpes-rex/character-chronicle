'use server';

/**
 * @fileOverview Server Actions for accessing D&D game data (classes, races, etc.).
 * These actions bridge the Next.js frontend with the NestJS DndApiService.
 */

import type { CharacterClass, CharacterRace, Feature, CharacterLevel, EquipmentItem, BackgroundInfo, SourcePack, Spell } from '@/lib/types'; // Use frontend alias
import { AppContainer } from '@/nestjs/app-container';
import { DndApiService } from '@/nestjs/dnd-api/dnd-api.service';
import { CampaignService } from '@/nestjs/campaign/campaign.service'; // Needed for combined content
import { logMessage, logError } from '@/services/logging-service'; // Use frontend logging service alias

// Helper function to get the DndApiService instance
const getDndApiService = async (): Promise<DndApiService> => {
  const container = await AppContainer.getInstance();
  return container.get(DndApiService);
};

// Helper function to get the CampaignService instance (for combined content)
const getCampaignService = async (): Promise<CampaignService> => {
    const container = await AppContainer.getInstance();
    return container.get(CampaignService);
};

// Helper function to get combined content based on campaign or user packs
const getCombinedContent = async (campaignId?: string): Promise<SourcePack['content'] | undefined> => {
    try {
        const campaignService = await getCampaignService();
        let packIds = ['srd']; // Default to SRD
        if (campaignId) {
            const campaign = await campaignService.loadCampaign(campaignId);
            if (campaign && campaign.activeSourcePackIds) {
                 packIds = [...new Set([...campaign.activeSourcePackIds, 'srd'])]; // Ensure SRD is always included
            }
        }
        // If no campaignId, we might load based on user preferences or default to SRD
        logMessage('debug', `[Action Helper] Getting combined content for packs: ${packIds.join(', ')}`, undefined, 'DndApiActions');
        const content = await campaignService.getCombinedContentFromPacks(packIds);
        return content;
    } catch (error) {
        logError(error, { message: '[Action Helper] Error getting combined content', campaignId }, 'DndApiActions');
        // Fallback to undefined or SRD content directly if preferred
        return undefined;
    }
};

// --- D&D Data Actions ---

// Pass optional campaignId to fetch content relevant to a specific campaign
export async function getCharacterClassesAction(campaignId?: string): Promise<{ success: boolean; classes: CharacterClass[]; error?: string }> {
  try {
    logMessage('debug', '[Action] Fetching character classes.', undefined, 'DndApiActions', { campaignId });
    const dndApiService = await getDndApiService();
    const combinedContent = await getCombinedContent(campaignId); // Fetch combined content
    const classes = await dndApiService.getCharacterClasses(combinedContent);
    logMessage('debug', `[Action] Fetched ${classes.length} character classes.`, undefined, 'DndApiActions');
    return { success: true, classes };
  } catch (error) {
    logError(error, { message: '[Action] Error fetching character classes.', campaignId }, 'DndApiActions');
    return { success: false, classes: [], error: error instanceof Error ? error.message : 'Failed to fetch character classes.' };
  }
}

export async function getCharacterRacesAction(campaignId?: string): Promise<{ success: boolean; races: CharacterRace[]; error?: string }> {
  try {
    logMessage('debug', '[Action] Fetching character races.', undefined, 'DndApiActions', { campaignId });
    const dndApiService = await getDndApiService();
    const combinedContent = await getCombinedContent(campaignId); // Fetch combined content
    const races = await dndApiService.getCharacterRaces(combinedContent);
    logMessage('debug', `[Action] Fetched ${races.length} character races.`, undefined, 'DndApiActions');
    return { success: true, races };
  } catch (error) {
    logError(error, { message: '[Action] Error fetching character races.', campaignId }, 'DndApiActions');
    return { success: false, races: [], error: error instanceof Error ? error.message : 'Failed to fetch character races.' };
  }
}

export async function getLevelUpOptionsAction(className: string, targetLevel: number, campaignId?: string): Promise<{ success: boolean; levelOptions: CharacterLevel; error?: string }> {
  try {
    logMessage('debug', `[Action] Fetching level up options for ${className} Lvl ${targetLevel}.`, undefined, 'DndApiActions', { campaignId });
    const dndApiService = await getDndApiService();
    const combinedContent = await getCombinedContent(campaignId); // Fetch combined content
    const levelOptions = await dndApiService.getLevelUpOptions(className, targetLevel, combinedContent);
    logMessage('debug', `[Action] Fetched level up options for ${className} Lvl ${targetLevel}. Features found: ${levelOptions.features.length}`, undefined, 'DndApiActions');
    return { success: true, levelOptions };
  } catch (error) {
    logError(error, { message: `[Action] Error fetching level up options for ${className} Lvl ${targetLevel}.`, campaignId }, 'DndApiActions');
     // Return a default structure on error to avoid breaking UI
    return { success: false, levelOptions: { level: targetLevel, features: [], proficiencyBonus: undefined }, error: error instanceof Error ? error.message : 'Failed to fetch level up options.' };
  }
}

export async function getAvailableEquipmentItemsAction(campaignId?: string): Promise<{ success: boolean; items: EquipmentItem[]; error?: string }> {
  try {
    logMessage('debug', '[Action] Fetching available equipment items.', undefined, 'DndApiActions', { campaignId });
    const dndApiService = await getDndApiService();
    const combinedContent = await getCombinedContent(campaignId); // Fetch combined content
    const items = await dndApiService.getAvailableEquipmentItems(combinedContent);
    logMessage('debug', `[Action] Fetched ${items.length} equipment items.`, undefined, 'DndApiActions');
    return { success: true, items };
  } catch (error) {
    logError(error, { message: '[Action] Error fetching equipment items.', campaignId }, 'DndApiActions');
    return { success: false, items: [], error: error instanceof Error ? error.message : 'Failed to fetch equipment items.' };
  }
}

export async function getAvailableBackgroundsAction(campaignId?: string): Promise<{ success: boolean; backgrounds: string[]; error?: string }> {
  try {
    logMessage('debug', '[Action] Fetching available background names.', undefined, 'DndApiActions', { campaignId });
    const dndApiService = await getDndApiService();
    const combinedContent = await getCombinedContent(campaignId); // Fetch combined content
    const backgrounds = await dndApiService.getAvailableBackgrounds(combinedContent);
    logMessage('debug', `[Action] Fetched ${backgrounds.length} background names.`, undefined, 'DndApiActions');
    return { success: true, backgrounds };
  } catch (error) {
    logError(error, { message: '[Action] Error fetching background names.', campaignId }, 'DndApiActions');
    return { success: false, backgrounds: [], error: error instanceof Error ? error.message : 'Failed to fetch background names.' };
  }
}

export async function getBackgroundDetailsAction(backgroundName: string, campaignId?: string): Promise<{ success: boolean; details: BackgroundInfo | null; error?: string }> {
  try {
    logMessage('debug', `[Action] Fetching details for background: ${backgroundName}.`, undefined, 'DndApiActions', { campaignId });
    const dndApiService = await getDndApiService();
    const combinedContent = await getCombinedContent(campaignId); // Fetch combined content
    const details = await dndApiService.getBackgroundDetails(backgroundName, combinedContent);
    logMessage('debug', `[Action] Background details ${details ? 'found' : 'not found'} for: ${backgroundName}.`, undefined, 'DndApiActions');
    return { success: true, details };
  } catch (error) {
    logError(error, { message: `[Action] Error fetching background details for ${backgroundName}.`, campaignId }, 'DndApiActions');
    return { success: false, details: null, error: error instanceof Error ? error.message : 'Failed to fetch background details.' };
  }
}

export async function getSpellsAction(campaignId?: string): Promise<{ success: boolean; spells: Spell[]; error?: string }> {
  try {
    logMessage('debug', '[Action] Fetching spells.', undefined, 'DndApiActions', { campaignId });
    const dndApiService = await getDndApiService();
    const combinedContent = await getCombinedContent(campaignId); // Fetch combined content
    const spells = await dndApiService.getSpells(combinedContent);
    logMessage('debug', `[Action] Fetched ${spells.length} spells.`, undefined, 'DndApiActions');
    return { success: true, spells };
  } catch (error) {
    logError(error, { message: '[Action] Error fetching spells.', campaignId }, 'DndApiActions');
    return { success: false, spells: [], error: error instanceof Error ? error.message : 'Failed to fetch spells.' };
  }
}
