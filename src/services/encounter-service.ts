
'use server';

import type { Encounter } from '@/lib/types';
import { AppContainer } from '@/nestjs/app-container';
import { EncounterService as NestEncounterService } from '@/nestjs/encounter/encounter.service';
import { logMessage, logError } from '@/services/logging-service';

const getEncounterService = async (): Promise<NestEncounterService> => {
  const container = await AppContainer.getInstance();
  return container.get(NestEncounterService);
};

// --- Server Actions ---

export async function saveEncounter(encounterData: Omit<Encounter, 'createdAt' | 'updatedAt'> & { id?: string }, dmUserId: string): Promise<string> {
  try {
    logMessage('info', `Attempting to save encounter: ${encounterData.name || encounterData.id || 'New Encounter'}`, { dmUserId });
    const service = await getEncounterService();
    const encounterId = await service.saveEncounter(encounterData, dmUserId);
    logMessage('info', `Encounter saved successfully: ${encounterId}`, { dmUserId, encounterName: encounterData.name });
    return encounterId;
  } catch (error) {
    logError(error, { message: `Error saving encounter ${encounterData.name || encounterData.id || 'New Encounter'}`, dmUserId });
    throw new Error(`Failed to save encounter: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function loadEncounter(encounterId: string): Promise<Encounter | null> {
  try {
    logMessage('debug', `Attempting to load encounter: ${encounterId}`);
    const service = await getEncounterService();
    const encounter = await service.loadEncounter(encounterId);
    logMessage('debug', `Encounter ${encounterId} ${encounter ? 'loaded' : 'not found'}.`);
    return encounter;
  } catch (error) {
    logError(error, { message: `Error loading encounter ${encounterId}` });
    return null; // Return null on error
  }
}

export async function loadAllEncounters(dmUserId: string): Promise<Encounter[]> {
  try {
    logMessage('debug', `Attempting to load all encounters for DM: ${dmUserId}`);
    const service = await getEncounterService();
    const encounters = await service.loadAllEncounters(dmUserId);
    logMessage('debug', `Loaded ${encounters.length} encounters for DM: ${dmUserId}`);
    return encounters;
  } catch (error) {
    logError(error, { message: `Error loading encounters for DM ${dmUserId}` });
    return []; // Return empty on error
  }
}

export async function deleteEncounter(encounterId: string, dmUserId: string): Promise<void> {
  try {
    logMessage('info', `Attempting to delete encounter: ${encounterId}`, { dmUserId });
    const service = await getEncounterService();
    await service.deleteEncounter(encounterId, dmUserId);
    logMessage('info', `Encounter deleted successfully: ${encounterId}`, { dmUserId });
  } catch (error) {
    logError(error, { message: `Error deleting encounter ${encounterId}`, dmUserId });
    throw new Error(`Failed to delete encounter: ${error instanceof Error ? error.message : String(error)}`);
  }
}
