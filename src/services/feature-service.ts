
'use server';

import type { Feature, Character, SourcePack } from '@/lib/types';
import { AppContainer } from '@/nestjs/app-container';
import { FeaturesService as NestFeaturesService } from '@/nestjs/features/features.service';
import { logMessage, logError } from '@/services/logging-service';

const getFeaturesService = async (): Promise<NestFeaturesService> => {
  const container = await AppContainer.getInstance();
  return container.get(NestFeaturesService);
};

// --- Server Actions ---

/** Fetches the full definition of a feature by its key/name. */
export async function getFeatureDefinition(
    featureKey: string,
    combinedContent?: SourcePack['content']
): Promise<Feature | null> {
    try {
        logMessage('debug', `Attempting to get feature definition: ${featureKey}`);
        const service = await getFeaturesService();
        const feature = await service.getFeatureDefinition(featureKey, combinedContent);
        logMessage('debug', `Feature definition ${feature ? 'found' : 'not found'} for: ${featureKey}`);
        return feature;
    } catch (error) {
        logError(error, { message: `Error getting feature definition for ${featureKey}` });
        return null;
    }
}

/** Fetches definitions for multiple features. */
export async function getMultipleFeatureDefinitions(
    featureKeys: string[],
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
    try {
        logMessage('debug', `Attempting to get definitions for multiple features: ${featureKeys.length}`);
        const service = await getFeaturesService();
        const features = await service.getMultipleFeatureDefinitions(featureKeys, combinedContent);
        logMessage('debug', `Fetched ${features.length} feature definitions.`);
        return features;
    } catch (error) {
        logError(error, { message: `Error getting multiple feature definitions`, featureKeys });
        return [];
    }
}

/** Retrieves features granted by a specific race name. */
export async function getRaceFeatures(
    raceName: string,
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
    try {
        logMessage('debug', `Attempting to get features for race: ${raceName}`);
        const service = await getFeaturesService();
        const features = await service.getRaceFeatures(raceName, combinedContent);
        logMessage('debug', `Found ${features.length} features for race: ${raceName}`);
        return features;
    } catch (error) {
        logError(error, { message: `Error getting features for race ${raceName}` });
        return [];
    }
}

/** Retrieves cumulative features granted by a specific class up to a given level. */
export async function getClassFeatures(
    className: string,
    level: number,
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
    try {
        logMessage('debug', `Attempting to get features for class: ${className} at level ${level}`);
        const service = await getFeaturesService();
        const features = await service.getClassFeatures(className, level, combinedContent);
        logMessage('debug', `Found ${features.length} features for class ${className} at level ${level}.`);
        return features;
    } catch (error) {
        logError(error, { message: `Error getting features for class ${className} at level ${level}` });
        return [];
    }
}

/** Retrieves features and proficiencies granted by a specific background name. */
export async function getBackgroundFeatures(
    backgroundName: string,
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
    try {
        logMessage('debug', `Attempting to get features for background: ${backgroundName}`);
        const service = await getFeaturesService();
        const features = await service.getBackgroundFeatures(backgroundName, combinedContent);
        logMessage('debug', `Found ${features.length} features for background: ${backgroundName}`);
        return features;
    } catch (error) {
        logError(error, { message: `Error getting features for background ${backgroundName}` });
        return [];
    }
}

/** Applies the effects of a character's features to their base state. */
export async function applyFeatureRules(baseCharacter: Character): Promise<Character> {
    try {
        logMessage('debug', `Applying feature rules for character: ${baseCharacter.id}`);
        const service = await getFeaturesService();
        const derivedCharacter = await service.applyFeatureRules(baseCharacter);
        logMessage('debug', `Finished applying feature rules for character: ${baseCharacter.id}`);
        return derivedCharacter;
    } catch (error) {
        logError(error, { message: `Error applying feature rules for character ${baseCharacter.id}` });
        // Return the base character in case of error to avoid breaking UI
        return baseCharacter;
    }
}
