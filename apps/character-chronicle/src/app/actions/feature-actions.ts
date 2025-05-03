'use server';

/**
 * @fileOverview Server Actions for accessing feature definitions and applying rules.
 * These actions bridge the Next.js frontend with the NestJS FeaturesService.
 */

import type { Feature, Character, SourcePack } from '@/lib/types'; // Use frontend alias
import { AppContainer } from '@/nestjs/app-container';
import { FeaturesService } from '@/nestjs/features/features.service';
import { CampaignService } from '@/nestjs/campaign/campaign.service'; // Needed for combined content
import { logMessage, logError } from '@/services/logging-service'; // Use frontend logging service alias

// Helper function to get the FeaturesService instance
const getFeaturesService = async (): Promise<FeaturesService> => {
  const container = await AppContainer.getInstance();
  return container.get(FeaturesService);
};

// Helper function to get the CampaignService instance (for combined content)
const getCampaignService = async (): Promise<CampaignService> => {
    const container = await AppContainer.getInstance();
    return container.get(CampaignService);
};

// Helper function to get combined content based on campaign or user packs
// TODO: Determine the correct pack IDs to use based on context (e.g., campaign ID, user settings)
const getCombinedContent = async (/* context parameters like campaignId or userId */): Promise<SourcePack['content'] | undefined> => {
    try {
        const campaignService = await getCampaignService();
        // Placeholder: Replace with actual logic to get relevant pack IDs
        const packIds = ['srd']; // Default to SRD for now
        const content = await campaignService.getCombinedContentFromPacks(packIds);
        return content;
    } catch (error) {
        logError(error, { message: '[Action Helper] Error getting combined content' });
        // Fallback to undefined or SRD content directly if preferred
        return undefined;
    }
};

// --- Feature Data Actions ---

/** Fetches the full definition of a feature by its key/name. */
export async function getFeatureDefinitionAction(featureKey: string): Promise<{ success: boolean; feature: Feature | null; error?: string }> {
    try {
        logMessage('debug', `[Action] Attempting to get feature definition: ${featureKey}`);
        const featuresService = await getFeaturesService();
        const combinedContent = await getCombinedContent();
        const feature = await featuresService.getFeatureDefinition(featureKey, combinedContent);
        logMessage('debug', `[Action] Feature definition ${feature ? 'found' : 'not found'} for: ${featureKey}`);
        return { success: true, feature };
    } catch (error) {
        logError(error, { message: `[Action] Error getting feature definition for ${featureKey}` });
        return { success: false, feature: null, error: error instanceof Error ? error.message : 'Failed to get feature definition.' };
    }
}

/** Fetches definitions for multiple features. */
export async function getMultipleFeatureDefinitionsAction(featureKeys: string[]): Promise<{ success: boolean; features: Feature[]; error?: string }> {
    try {
        logMessage('debug', `[Action] Attempting to get definitions for multiple features: ${featureKeys.length}`);
        const featuresService = await getFeaturesService();
        const combinedContent = await getCombinedContent();
        const features = await featuresService.getMultipleFeatureDefinitions(featureKeys, combinedContent);
        logMessage('debug', `[Action] Fetched ${features.length} feature definitions.`);
        return { success: true, features };
    } catch (error) {
        logError(error, { message: `[Action] Error getting multiple feature definitions`, featureKeys });
        return { success: false, features: [], error: error instanceof Error ? error.message : 'Failed to get multiple feature definitions.' };
    }
}

/** Retrieves features granted by a specific race name. */
export async function getRaceFeaturesAction(raceName: string): Promise<{ success: boolean; features: Feature[]; error?: string }> {
    try {
        logMessage('debug', `[Action] Attempting to get features for race: ${raceName}`);
        const featuresService = await getFeaturesService();
        const combinedContent = await getCombinedContent();
        const features = await featuresService.getRaceFeatures(raceName, combinedContent);
        logMessage('debug', `[Action] Found ${features.length} features for race: ${raceName}`);
        return { success: true, features };
    } catch (error) {
        logError(error, { message: `[Action] Error getting features for race ${raceName}` });
        return { success: false, features: [], error: error instanceof Error ? error.message : 'Failed to get race features.' };
    }
}

/** Retrieves cumulative features granted by a specific class up to a given level. */
export async function getClassFeaturesAction(className: string, level: number): Promise<{ success: boolean; features: Feature[]; error?: string }> {
    try {
        logMessage('debug', `[Action] Attempting to get features for class: ${className} at level ${level}`);
        const featuresService = await getFeaturesService();
        const combinedContent = await getCombinedContent();
        const features = await featuresService.getClassFeatures(className, level, combinedContent);
        logMessage('debug', `[Action] Found ${features.length} features for class ${className} at level ${level}.`);
        return { success: true, features };
    } catch (error) {
        logError(error, { message: `[Action] Error getting features for class ${className} at level ${level}` });
        return { success: false, features: [], error: error instanceof Error ? error.message : 'Failed to get class features.' };
    }
}

/** Retrieves features and proficiencies granted by a specific background name. */
export async function getBackgroundFeaturesAction(backgroundName: string): Promise<{ success: boolean; features: Feature[]; error?: string }> {
    try {
        logMessage('debug', `[Action] Attempting to get features for background: ${backgroundName}`);
        const featuresService = await getFeaturesService();
        const combinedContent = await getCombinedContent();
        const features = await featuresService.getBackgroundFeatures(backgroundName, combinedContent);
        logMessage('debug', `[Action] Found ${features.length} features for background: ${backgroundName}.`);
        return { success: true, features };
    } catch (error) {
        logError(error, { message: `[Action] Error getting features for background ${backgroundName}` });
        return { success: false, features: [], error: error instanceof Error ? error.message : 'Failed to get background features.' };
    }
}

/** Applies the effects of a character's features to their base state. */
export async function applyFeatureRulesAction(baseCharacter: Character): Promise<{ success: boolean; character?: Character; error?: string }> {
    try {
        logMessage('debug', `[Action] Applying feature rules for character: ${baseCharacter.id}`);
        const featuresService = await getFeaturesService();
        const derivedCharacter = await featuresService.applyFeatureRules(baseCharacter);
        logMessage('debug', `[Action] Finished applying feature rules for character: ${baseCharacter.id}`);
        return { success: true, character: derivedCharacter };
    } catch (error) {
        logError(error, { message: `[Action] Error applying feature rules for character ${baseCharacter.id}` });
        // Return the base character in case of error to allow UI to handle gracefully
        return { success: false, character: baseCharacter, error: error instanceof Error ? error.message : 'Failed to apply feature rules.' };
    }
}

    