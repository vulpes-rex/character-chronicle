'use server';

/**
 * @fileOverview Server Actions for encounter management.
 * These actions bridge the Next.js frontend with the NestJS EncounterService.
 */

import type { Encounter } from '@/lib/types'; // Use frontend alias
import { AppContainer } from '@/nestjs/app-container';
import { EncounterService } from '@/nestjs/encounter/encounter.service';
import { logMessage, logError } from '@/services/logging-service'; // Use frontend logging service alias

// Helper function to get the EncounterService instance
const getEncounterService = async (): Promise<EncounterService> => {
  const container = await AppContainer.getInstance();
  return container.get(EncounterService);
};

// --- Encounter Management Actions ---

export async function saveEncounterAction(encounterData: Omit<Encounter, 'createdAt' | 'updatedAt'> & { id?: string }, dmUserId: string): Promise<{ success: boolean; encounterId?: string; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to save encounter: ${encounterData.name || encounterData.id || 'New Encounter'}`, { dmUserId });
    const encounterService = await getEncounterService();
    const encounterId = await encounterService.saveEncounter(encounterData, dmUserId);
    logMessage('info', `[Action] Encounter saved successfully: ${encounterId}`, { dmUserId, encounterName: encounterData.name });
    return { success: true, encounterId };
  } catch (error) {
    logError(error, { message: `[Action] Error saving encounter ${encounterData.name || encounterData.id || 'New Encounter'}`, dmUserId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save encounter.' };
  }
}

export async function loadEncounterAction(encounterId: string): Promise<{ success: boolean; encounter?: Encounter | null; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load encounter: ${encounterId}`);
    const encounterService = await getEncounterService();
    const encounter = await encounterService.loadEncounter(encounterId);
    logMessage('debug', `[Action] Encounter ${encounterId} ${encounter ? 'loaded' : 'not found'}.`);
    return { success: true, encounter };
  } catch (error) {
    logError(error, { message: `[Action] Error loading encounter ${encounterId}` });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load encounter.' };
  }
}

export async function loadAllEncountersAction(dmUserId: string): Promise<{ success: boolean; encounters: Encounter[]; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load all encounters for DM: ${dmUserId}`);
    const encounterService = await getEncounterService();
    const encounters = await encounterService.loadAllEncounters(dmUserId);
    logMessage('debug', `[Action] Loaded ${encounters.length} encounters for DM: ${dmUserId}`);
    return { success: true, encounters };
  } catch (error) {
    logError(error, { message: `[Action] Error loading encounters for DM ${dmUserId}` });
    return { success: false, encounters: [], error: error instanceof Error ? error.message : 'Failed to load encounters.' };
  }
}

export async function deleteEncounterAction(encounterId: string, dmUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to delete encounter: ${encounterId}`, { dmUserId });
    const encounterService = await getEncounterService();
    await encounterService.deleteEncounter(encounterId, dmUserId);
    logMessage('info', `[Action] Encounter deleted successfully: ${encounterId}`, { dmUserId });
    return { success: true };
  } catch (error) {
    logError(error, { message: `[Action] Error deleting encounter ${encounterId}`, dmUserId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete encounter.' };
  }
}

// --- Encounter Running Actions (Example - Needs further implementation) ---

export async function updateEncounterStateAction(encounterId: string, updates: Partial<Encounter>, dmUserId: string): Promise<{ success: boolean; error?: string }> {
    // This action would likely call a specific method in EncounterService
    // to update initiative, HP, conditions, turn order, etc.
    try {
        logMessage('info', `[Action] Updating state for encounter: ${encounterId}`, { dmUserId, updates: Object.keys(updates) });
        const encounterService = await getEncounterService();
        // Assuming a method like updateEncounterState exists:
        // await encounterService.updateEncounterState(encounterId, updates, dmUserId);
        await encounterService.saveEncounter({ ...updates, id: encounterId, campaignId: 'dummy' }, dmUserId); // Simplified update for now
        logMessage('info', `[Action] Encounter state updated successfully: ${encounterId}`, { dmUserId });
        return { success: true };
    } catch (error) {
        logError(error, { message: `[Action] Error updating encounter state ${encounterId}`, dmUserId });
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update encounter state.' };
    }
}

    