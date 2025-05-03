

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveCharacter, updateCharacter } from '@/services/character-service'; // Import updateCharacter
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, CharacterClass as CharacterClassType, SourcePack } from '@/lib/types';
import { getCharacterClasses, getCharacterRaces, getCumulativeClassFeatures, getRaceFeatures, getAvailableEquipmentItems, getBackgroundDetails } from '@/services/dnd-api'; // Updated imports
import { getBackgroundFeatures } from '@/services/feature-service'; // Import feature service for background features
import { calculateSkillModifier, SKILL_ABILITY_MAP, ALL_SKILLS, rollDice } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getCombinedContentFromPacks } from '@/services/campaign-service'; // Import function to get combined content
import { applyFeatureRules } from '@/services/feature-service'; // Import feature application service

// Import step components
import { Step1BasicInfo } from './step-1-basic-info';
import { Step2RaceSelection } from './step-2-race-selection';
import { Step3ClassSelection } from './step-3-class-selection';
import { Step4AbilityScores } from './step-4-ability-scores';
import { Step5Background } from './step-5-background';
import { Step6Equipment } from './step-6-equipment';
import { Step7Features } from './step-7-features'; // Import the new step

export type PartialCharacterFormData = Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'hitPoints' | 'hitDice' | 'features' | 'proficiencies' | 'skills' | 'equipment'> & {
    // Allow nested partials for stats and equipment
    stats?: Partial<Character['stats']>;
    equipment?: Partial<EquipmentItem>[]; // Allow partial items during build
    skills?: Partial<Record<string, boolean>>; // Track skill proficiency selections explicitly
    selectedClasses?: { [key: string]: number }; // Track selected classes and levels
    // Track choices made for features
    featureChoices?: Record<string, string | string[]>; // { 'Fighting Style': 'Archery', 'ExtraLanguage': 'Elvish' }
    // Remove tempFeatures and tempProficiencies - steps update core data directly
    activeSourcePackIds?: string[]; // Track selected source packs (relevant if selectable during creation)
}>;

// Helper to map full Character to PartialCharacterFormData for initialization
const mapCharacterToFormData = (char: Character): PartialCharacterFormData => ({
    playerName: char.playerName,
    characterName: char.characterName,
    race: char.race,
    class: char.class, // Keep for backward compatibility/reference if needed
    level: char.level,
    background: char.background,
    alignment: char.alignment,
    stats: char.stats, // Save the base stats as they are stored
    skills: char.skills, // Direct skill proficiencies saved
    equipment: (char.equipment as Partial<EquipmentItem>[])?.map(item => ({ ...item, name: item.name, quantity: item.quantity ?? 1})) || [], // Ensure name and quantity are present
    backstory: char.backstory,
    appearance: char.appearance,
    // Correctly initialize selectedClasses from character's class and level
    selectedClasses: char.class ? { [char.class]: char.level } : {}, // Simple single class representation for now
    featureChoices: char.featureChoices || {}, // Initialize feature choices
    // Don't map features or proficiencies here, let loadCharacter handle derivation
    activeSourcePackIds: ['srd'], // Default or needs fetching based on context (e.g., campaign)
});


interface CharacterCreationWizardProps {
    initialData?: Character; // Optional initial data for editing
    editMode?: boolean; // Flag for edit mode
}

export function CharacterCreationWizard({ initialData, editMode = false }: CharacterCreationWizardProps) {
    const TOTAL_STEPS = editMode ? 6 : 7; // Added Features step
    const [currentStep, setCurrentStep] = useState(1);
    const [characterData, setCharacterData] = useState<PartialCharacterFormData>(
        initialData ? mapCharacterToFormData(initialData) : {
            playerName: '',
            characterName: '',
            race: '',
            // class: '', // Remove direct initialization of class? Rely on selectedClasses
            level: 1,
            background: '',
            alignment: '',
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }, // Initial base stats
            skills: ALL_SKILLS.reduce((acc, skill) => { acc[skill] = false; return acc; }, {} as Record<string, boolean>), // Initialize all skills to not proficient
            equipment: [],
            backstory: '',
            appearance: '',
            selectedClasses: {}, // Start empty
            featureChoices: {}, // Initialize empty feature choices
            // Removed tempFeatures and tempProficiencies
            activeSourcePackIds: ['srd'], // Default to SRD
        }
    );
    const [isValid, setIsValid] = useState(false); // Track if current step data is valid
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    // Fetch combined content based on active packs (defaults to 'srd')
    // Use characterData.activeSourcePackIds which might be updated by a campaign selection step if added later
    const { data: combinedContent, isLoading: isLoadingContent } = useQuery<SourcePack['content'], Error>({
        queryKey: ['combinedContent', characterData.activeSourcePackIds],
        queryFn: () => getCombinedContentFromPacks(characterData.activeSourcePackIds || ['srd']),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        enabled: true, // Always enabled, will refetch if activeSourcePackIds changes
    });


    // Fetch classes, races, etc. using the combined content
     const { data: availableClasses = [], isLoading: isLoadingClasses } = useQuery<CharacterClassType[], Error>({
        queryKey: ['characterClasses', combinedContent], // Include combinedContent in key
        queryFn: () => getCharacterClasses(combinedContent),
        enabled: !!combinedContent, // Enable only when content is loaded
        staleTime: Infinity,
    });

    const { data: availableRaces = [], isLoading: isLoadingRaces } = useQuery<Awaited<ReturnType<typeof getCharacterRaces>>, Error>({
        queryKey: ['characterRaces', combinedContent], // Include combinedContent in key
        queryFn: () => getCharacterRaces(combinedContent),
        enabled: !!combinedContent, // Enable only when content is loaded
        staleTime: Infinity,
    });

     // Fetch cumulative features for the current class/level selection
     const currentLevel = Object.values(characterData.selectedClasses ?? {}).reduce((sum, lvl) => sum + lvl, 0) || 1;
     const primaryClass = Object.keys(characterData.selectedClasses || {})[0];
     const { data: cumulativeFeatures = [], isLoading: isLoadingFeatures } = useQuery<Feature[], Error>({
        queryKey: ['cumulativeFeatures', primaryClass, currentLevel, combinedContent],
        queryFn: () => primaryClass && combinedContent ? getCumulativeClassFeatures(primaryClass, currentLevel, combinedContent) : Promise.resolve([]),
        enabled: !!primaryClass && currentLevel > 0 && !!combinedContent,
     });

    const isFetchingInitialData = isLoadingContent || isLoadingClasses || isLoadingRaces || isLoadingFeatures;


    // Memoize updateCharacterData to prevent re-renders in child components
     const updateCharacterData = useCallback((newData: Partial<PartialCharacterFormData>) => {
        console.log("Wizard: Updating parent data with:", newData); // Debug log
        setCharacterData(prev => ({ ...prev, ...newData }));
    }, []); // No dependencies, function identity is stable


    // Memoize setValidity using useCallback
     const setValidityCallback = useCallback((valid: boolean) => {
         setIsValid(valid);
     }, []); // Dependency on the state setter function


    const handleNext = () => {
        if (isValid) {
            setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
            setIsValid(false); // Reset validity for the next step using the state setter
        } else {
            toast({ variant: 'destructive', title: 'Incomplete Step', description: 'Please complete the required fields.' });
        }
    };

    const handlePrevious = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
        setIsValid(true); // Assume previous step was valid, use state setter
    };


    const handleFinalSubmit = async () => {
        console.log("Wizard: Final Submit Triggered. Current State:", characterData); // Debug log
        if (!isValid) {
            toast({ variant: 'destructive', title: 'Incomplete Step', description: 'Please complete the final step.' });
            return;
        }
        if (!combinedContent) {
             toast({ variant: 'destructive', title: 'Data Error', description: 'Core content data failed to load. Cannot save character.' });
             return;
        }
        setIsLoading(true);
        setApiError(null);

        try {
             // --- Aggregate chosen data ---
             const finalLevel = Object.values(characterData.selectedClasses ?? {}).reduce((sum, lvl) => sum + lvl, 0) || 1;
             let primaryClassKey = Object.keys(characterData.selectedClasses || {})[0] || '';

              if (!characterData.race) throw new Error("Character race selection is missing.");
              if (!primaryClassKey) throw new Error("Character class selection is missing.");

             // --- Fetch ALL Features based on final selections ---
             const raceFeatures = await getRaceFeatures(characterData.race, combinedContent);
             const classFeatures = await getCumulativeClassFeatures(primaryClassKey, finalLevel, combinedContent);
             const backgroundFeatures = characterData.background ? await getBackgroundFeatures(characterData.background, combinedContent) : [];
             const allFeatures = [...raceFeatures, ...classFeatures, ...backgroundFeatures];

             // Apply choices to feature list (e.g., replace "Fighting Style" with "Fighting Style: Archery")
             // This is a simplified approach; a more robust system might store the choice alongside the base feature.
             const featuresWithChoicesApplied = allFeatures.map(feature => {
                 if (feature.metadata?.effectType === 'choiceGrant') {
                    const choiceKey = feature.metadata.choiceKey;
                    const choice = characterData.featureChoices?.[choiceKey];
                     if (choice && typeof choice === 'string' && feature.metadata.options.includes(choice)) {
                         // Create a specific feature based on the choice
                         // This assumes the choice name maps directly to a more specific feature definition
                         // For example, choosing "Archery" for "Fighting Style" might link to a "Fighting Style: Archery" feature
                         // If not, we just keep the original feature name but might add the choice to its description/notes later.
                         // Let's assume for now the choice IS the specific feature name fragment.
                         const specificFeatureName = `${feature.name}: ${choice}`;
                         // Try to find the definition for the specific feature choice
                         const specificFeatureDef = BASE_FEATURE_DEFINITIONS[specificFeatureName] ?? combinedContent?.features?.[specificFeatureName];
                         if (specificFeatureDef) {
                            return { ...specificFeatureDef, name: specificFeatureName, source: feature.source };
                         } else {
                             // If no specific definition, return the original feature but maybe note the choice?
                             // Or filter it out? For now, return original.
                              console.warn(`Specific definition for choice "${choice}" of feature "${feature.name}" not found.`);
                             return feature;
                         }
                     }
                 } else if (feature.metadata?.effectType === 'proficiencyGrant' && feature.metadata.choose && feature.metadata.options) {
                      const choiceKey = feature.name; // Use feature name as the choice key for proficiencies
                      const choices = characterData.featureChoices?.[choiceKey];
                      if (choices && Array.isArray(choices)) {
                          // Modify the feature to reflect the chosen proficiencies
                          return {
                              ...feature,
                              description: `${feature.description} Chosen: ${choices.join(', ')}.`,
                              // Optionally replace metadata proficiencies with chosen ones if applying rules here
                          };
                      }
                 }
                 return feature;
             }).filter(f => f.metadata?.effectType !== 'choiceGrant'); // Remove the generic choice features

             // --- Calculate BASE Stats, HitPoints, HitDice (without derived rules applied yet) ---
             const baseStats = characterData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
             // Apply STAT bonuses from features TO BASE STATS - this is complex with Tasha's etc.
             // Step 4 handles applying racial bonuses based on choices. We trust the `characterData.stats` from that step.
             const statsAfterRacial = { ...baseStats }; // Start with stats potentially modified by Step 4

             // We need the final CON modifier AFTER applying potential feature bonuses here
             let tempCon = statsAfterRacial.constitution;
             featuresWithChoicesApplied.forEach(f => {
                 if (f.metadata?.effectType === 'statBonus' && f.metadata.stats?.constitution) {
                    tempCon += f.metadata.stats.constitution;
                 }
             });
             const finalConModifier = Math.floor((tempCon - 10) / 2);


             let finalMaxHp = 0;
             let primaryHitDie: HitDiceState['dieType'] = null;

            Object.entries(characterData.selectedClasses ?? { [primaryClassKey]: finalLevel }).forEach(([className, level], index) => {
                const classData = combinedContent?.classes?.[className];
                if (!classData) return;
                const classHitDieSides = parseInt(classData.hitDie.substring(1), 10);
                if (index === 0) primaryHitDie = classData.hitDie;

                if (index === 0) { // First class (or only class)
                    finalMaxHp = classHitDieSides + finalConModifier;
                    if (level > 1) {
                        finalMaxHp += (level - 1) * (Math.ceil((classHitDieSides + 1) / 2) + finalConModifier);
                    }
                } else { // Multiclass levels
                    for (let i = 0; i < level; i++) {
                        finalMaxHp += Math.ceil((classHitDieSides + 1) / 2) + finalConModifier;
                    }
                }
            });
             finalMaxHp = Math.max(1, finalMaxHp);

             const finalHitPoints: HitPointsState = {
                 max: finalMaxHp,
                 current: editMode && initialData?.hitPoints?.current !== undefined ? initialData.hitPoints.current : finalMaxHp,
                 temporary: editMode && initialData?.hitPoints?.temporary !== undefined ? initialData.hitPoints.temporary : 0,
             };
             const finalHitDice: HitDiceState = {
                 total: finalLevel,
                 remaining: editMode && initialData?.hitDice?.remaining !== undefined ? initialData.hitDice.remaining : finalLevel,
                 dieType: primaryHitDie,
             };

            // --- Construct final Character object for saving ---
            // IMPORTANT: Save BASE stats, not derived ones. Save selected skills, not derived modifiers.
             const characterToSave: Partial<Omit<Character, 'id' | 'createdAt'>> & {id?: string} = {
                 id: initialData?.id,
                 playerName: characterData.playerName || '',
                 characterName: characterData.characterName || '',
                 race: characterData.race || '',
                 class: primaryClassKey, // Store primary class key
                 level: finalLevel,
                 background: characterData.background || '',
                 alignment: characterData.alignment || '',
                 stats: statsAfterRacial, // Save the BASE stats from the wizard state (including racial bonus application from Step 4)
                 skills: characterData.skills || {}, // Save only the *selected* skill proficiencies
                 hitPoints: finalHitPoints, // Save calculated HP
                 hitDice: finalHitDice, // Save calculated Hit Dice
                 equipment: (characterData.equipment as EquipmentItem[])?.map(item => ({ // Ensure full item structure
                    name: item.name || 'Unnamed Item', // Ensure name exists
                    quantity: item.quantity ?? 1,
                    description: item.description,
                    weight: item.weight,
                    cost: item.cost,
                    type: item.type,
                    isEquipped: item.isEquipped ?? false,
                    weaponCategory: item.weaponCategory,
                    damageDice: item.damageDice,
                    damageType: item.damageType,
                    properties: item.properties,
                    armorCategory: item.armorCategory,
                    baseAC: item.baseAC,
                    addDexModifier: item.addDexModifier,
                    maxDexBonus: item.maxDexBonus,
                    strengthRequirement: item.strengthRequirement,
                    stealthDisadvantage: item.stealthDisadvantage,
                 })) || [],
                 proficiencies: { // Start with empty base proficiencies - features will add them on load
                      armor: [],
                      weapons: [],
                      tools: [],
                      savingThrows: [],
                      languages: [],
                 },
                 features: featuresWithChoicesApplied, // Save the feature objects including choices applied
                 featureChoices: characterData.featureChoices || {}, // Persist the choices made
                 backstory: characterData.backstory || '',
                 appearance: characterData.appearance || '',
                 campaignId: initialData?.campaignId, // Preserve campaign ID if editing
             };


            // Remove temporary or undefined fields before saving
            delete (characterToSave as any).selectedClasses;
            delete (characterToSave as any).activeSourcePackIds;

            if (editMode && initialData?.id) {
                await updateCharacter(initialData.id, characterToSave);
                toast({ title: 'Character Updated', description: `${characterToSave.characterName} has been successfully updated.` });
                router.push(`/character/view/${initialData.id}`); // Redirect to view page
                router.refresh(); // Force refresh to show updated data
            } else {
                // Remove ID for creation
                delete characterToSave.id;
                const newId = await saveCharacter(characterToSave as Omit<Character, 'id' | 'createdAt' | 'updatedAt'>);
                toast({ title: 'Character Created', description: `${characterToSave.characterName} has been successfully created.` });
                router.push(`/character/view/${newId}`);
            }
        } catch (error) {
            console.error('Failed to save character:', error);
            const message = error instanceof Error ? error.message : 'An unknown error occurred during saving.';
            setApiError(message);
            toast({ variant: 'destructive', title: 'Save Failed', description: message });
        } finally {
            setIsLoading(false);
        }
    };

    const renderStep = () => {
        // Pass combinedContent to steps that need it
        switch (currentStep) {
            case 1:
                return <Step1BasicInfo data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} />;
            case 2:
                // Pass combinedContent to Step2RaceSelection for trait details
                return <Step2RaceSelection data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableRaces={availableRaces} combinedContent={combinedContent} />;
            case 3:
                // Pass combinedContent to Step3ClassSelection for feature details
                return <Step3ClassSelection data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableClasses={availableClasses} combinedContent={combinedContent} />;
            case 4:
                // Race data is needed here for racial bonus display/Tasha's rule interaction
                return <Step4AbilityScores data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableRaces={availableRaces} editMode={editMode} />;
            case 5:
                 // Pass combinedContent to Step5Background for details and suggestions
                return <Step5Background data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} combinedContent={combinedContent} />;
             case 6: // Features step (moved equipment to last)
                return <Step7Features
                            data={characterData}
                            updateData={updateCharacterData}
                            setValidity={setValidityCallback}
                            allFeatures={cumulativeFeatures} // Pass features derived from class/race/background
                            isLoadingFeatures={isLoadingFeatures}
                            combinedContent={combinedContent} // Pass content for fetching feature options if needed
                        />;
            case 7: // Equipment Step (Now last)
                 if (!editMode) {
                     // Pass combinedContent to Step6Equipment for item definitions
                    return <Step6Equipment data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} combinedContent={combinedContent} />;
                 }
                 // In edit mode, step 6 (Features) is the last step
                 return <div>Character details saved. Navigate back or view sheet.</div>;
            default:
                return <div>Invalid Step</div>;
        }
    };

    if (isFetchingInitialData) {
        return (
          <div className="space-y-4 p-4 md:p-6">
             <Skeleton className="h-8 w-1/4" />
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-64 w-full" />
             <div className="flex justify-between">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
             </div>
          </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold mb-6">{editMode ? 'Edit Character' : 'Create New Character'} (Step {currentStep} of {TOTAL_STEPS})</h1>
            <Progress value={(currentStep / TOTAL_STEPS) * 100} className="w-full mb-6" />

            {apiError && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{apiError}</AlertDescription>
                </Alert>
            )}

            <div className="min-h-[400px]"> {/* Ensure content area doesn't jump */}
                {renderStep()}
            </div>

            <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1 || isLoading}>
                    Previous
                </Button>
                {currentStep < TOTAL_STEPS ? (
                    <Button onClick={handleNext} disabled={!isValid || isLoading || isFetchingInitialData}>
                        Next
                    </Button>
                ) : (
                    <Button onClick={handleFinalSubmit} disabled={!isValid || isLoading || isFetchingInitialData}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editMode ? 'Save Changes' : 'Finish & Create Character'}
                    </Button>
                )}
            </div>
        </div>
    );
}
