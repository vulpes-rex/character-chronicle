'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { saveCharacterAction, updateCharacterAction } from '@/app/actions/character-actions'; // Use Server Actions
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, CharacterClass as CharacterClassType, SourcePack, BackgroundInfo, CharacterRace, Spell } from '@/lib/types';
import { getCharacterClassesAction, getCharacterRacesAction, getAvailableEquipmentItemsAction, getAvailableBackgroundsAction, getBackgroundDetailsAction, getSpellsAction } from '@/app/actions/dnd-api-actions'; // Use Server Actions
import { getBackgroundFeaturesAction, getRaceFeaturesAction, getClassFeaturesAction } from '@/app/actions/feature-actions'; // Use Server Actions
import { calculateSkillModifier, SKILL_ABILITY_MAP, ALL_SKILLS, rollDice } from '@/lib/types'; // Import type helpers directly
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
// No direct feature service needed here anymore, actions call the NestJS FeatureService

// Import step components
import { Step1BasicInfo } from './step-1-basic-info';
import { Step2RaceSelection } from './step-2-race-selection';
import { Step3ClassSelection } from './step-3-class-selection';
import { Step4AbilityScores } from './step-4-ability-scores';
import { Step5Background } from './step-5-background';
import { Step6Equipment } from './step-6-equipment';
import { Step7Review } from './step-7-review';
import { Step8Spells } from './step-8-spells'; // Import Step 8
import { useAuth } from '@/components/auth-provider'; // Import useAuth hook


// Total number of steps in the wizard
const TOTAL_STEPS = 8; // Increased to 8 for Spells

// Partial type for form data across steps
export type PartialCharacterFormData = Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'stats'>> & {
    stats?: Partial<Character['baseStats']>; // Use baseStats during creation/edit
    // Add temporary fields if needed during creation that aren't directly on Character model
    selectedClassLevels?: Record<string, number>; // For multiclassing levels
};

interface CharacterCreationWizardProps {
    initialData?: Character; // For editing existing characters
    editMode?: boolean;
}

export function CharacterCreationWizard({ initialData, editMode = false }: CharacterCreationWizardProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [characterData, setCharacterData] = useState<PartialCharacterFormData>(
         initialData ? {
            ...initialData,
            stats: initialData.baseStats, // Use baseStats if editing
            selectedClassLevels: initialData.level ? { [initialData.class]: initialData.level } : {}, // Initialize from initialData if available
            // Ensure arrays are initialized properly
            features: initialData.features || [],
            equipment: initialData.equipment || [],
            proficiencies: initialData.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [], languages: [] },
            skills: initialData.skills || {},
            spellsKnown: initialData.spellsKnown || [],
            spellsPrepared: initialData.spellsPrepared || [],
        } : {
            level: 1, // Default level
            hitPoints: { max: 0, current: 0, temporary: 0 },
            hitDice: { total: 1, remaining: 1, dieType: null },
            features: [],
            equipment: [],
            proficiencies: { armor: [], weapons: [], tools: [], savingThrows: [], languages: [] },
            skills: {},
            spellsKnown: [],
            spellsPrepared: [],
            selectedClassLevels: {},
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }, // Default base stats
        }
    );
    const [isStepValid, setIsStepValid] = useState(false); // Track validity of the current step
    const [isLoading, setIsLoading] = useState(false); // For final save/update
    const [apiError, setApiError] = useState<string | null>(null);

    // State for fetched API data
    const [availableRaces, setAvailableRaces] = useState<CharacterRace[]>([]);
    const [availableClasses, setAvailableClasses] = useState<CharacterClassType[]>([]);
    const [availableBackgrounds, setAvailableBackgrounds] = useState<string[]>([]);
    const [availableItems, setAvailableItems] = useState<EquipmentItem[]>([]);
     const [availableSpells, setAvailableSpells] = useState<Spell[]>([]); // State for spells

    // Loading states for API calls
    const [isLoadingRaces, setIsLoadingRaces] = useState(false);
    const [isLoadingClasses, setIsLoadingClasses] = useState(false);
    const [isLoadingBackgrounds, setIsLoadingBackgrounds] = useState(false);
    const [isLoadingItems, setIsLoadingItems] = useState(false);
    const [isLoadingSpells, setIsLoadingSpells] = useState(false); // Loading state for spells


    const { toast } = useToast();
    const router = useRouter();
     const { user } = useAuth(); // Get user for save/update actions

     // Determine campaign context (if editing, from initialData, otherwise maybe default or none)
     const campaignId = initialData?.campaignId;

    // Fetch initial data needed for the wizard
    useEffect(() => {
        const fetchData = async () => {
            // Reset loading states
            setIsLoadingRaces(true);
            setIsLoadingClasses(true);
            setIsLoadingBackgrounds(true);
            setIsLoadingItems(true);
             setIsLoadingSpells(true);

            try {
                // Fetch data concurrently
                const [racesResult, classesResult, backgroundsResult, itemsResult, spellsResult] = await Promise.all([
                    getCharacterRacesAction(campaignId),
                    getCharacterClassesAction(campaignId),
                    getAvailableBackgroundsAction(campaignId),
                    getAvailableEquipmentItemsAction(campaignId),
                     getSpellsAction(campaignId) // Fetch spells
                ]);

                if (racesResult.success) setAvailableRaces(racesResult.races); else console.error("Failed to load races:", racesResult.error);
                if (classesResult.success) setAvailableClasses(classesResult.classes); else console.error("Failed to load classes:", classesResult.error);
                if (backgroundsResult.success) setAvailableBackgrounds(backgroundsResult.backgrounds); else console.error("Failed to load backgrounds:", backgroundsResult.error);
                if (itemsResult.success) setAvailableItems(itemsResult.items); else console.error("Failed to load items:", itemsResult.error);
                 if (spellsResult.success) setAvailableSpells(spellsResult.spells); else console.error("Failed to load spells:", spellsResult.error);


            } catch (error) {
                console.error("Error fetching wizard data:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load necessary data for character creation.' });
            } finally {
                setIsLoadingRaces(false);
                setIsLoadingClasses(false);
                setIsLoadingBackgrounds(false);
                setIsLoadingItems(false);
                 setIsLoadingSpells(false);
            }
        };
        fetchData();
    }, [toast, campaignId]); // Fetch once on mount, potentially refetch if campaign context changes

    const updateCharacterData = useCallback((newData: PartialCharacterFormData) => {
        setCharacterData(prev => ({ ...prev, ...newData }));
    }, []); // Memoize update function

    // Function to dynamically calculate features based on race and class selections
    const recalculateFeatures = useCallback(async () => {
         if (!characterData.race || !characterData.selectedClassLevels || Object.keys(characterData.selectedClassLevels).length === 0) {
            return { baseFeatures: [], backgroundFeatures: [] }; // No race/class selected yet
         }

         const raceFeaturesResult = await getRaceFeaturesAction(characterData.race, campaignId);
         let raceFeatures: Feature[] = [];
         if (raceFeaturesResult.success) {
            raceFeatures = raceFeaturesResult.features;
         } else {
            console.error("Failed to load race features:", raceFeaturesResult.error);
         }

         const classFeaturePromises = Object.entries(characterData.selectedClassLevels).map(([className, level]) =>
            getClassFeaturesAction(className, level, campaignId)
         );
         const classFeatureResults = await Promise.all(classFeaturePromises);
         const classFeatures = classFeatureResults.flatMap(result => {
            if (result.success) {
                 return result.features;
            } else {
                 console.error("Failed to load class features:", result.error);
                 return [];
            }
         });

         // Fetch background features if background is selected
         let backgroundFeatures: Feature[] = [];
         if (characterData.background) {
             const bgFeaturesResult = await getBackgroundFeaturesAction(characterData.background, campaignId);
             if (bgFeaturesResult.success) {
                 backgroundFeatures = bgFeaturesResult.features;
             } else {
                 console.error("Failed to load background features:", bgFeaturesResult.error);
             }
         }


         // Combine and unique features (basic combination)
         const baseFeatures = [...new Map([...raceFeatures, ...classFeatures].map(f => [f.name, f])).values()];

          // Update derived state (like proficiencies, maybe HP) based on new features
         // This part might be complex and could involve calling applyFeatureRulesAction
         // For now, just return the collected features
          return { baseFeatures, backgroundFeatures };

     }, [characterData.race, characterData.selectedClassLevels, characterData.background, campaignId]);

     // Update features whenever race, class, level, or background changes
     useEffect(() => {
        const updateFeatures = async () => {
            const { baseFeatures, backgroundFeatures } = await recalculateFeatures();
            // Combine all features for the character state
            const allFeatures = [...new Map([...baseFeatures, ...backgroundFeatures].map(f => [f.name, f])).values()];
            updateCharacterData({ features: allFeatures });
        };
        updateFeatures();
    }, [recalculateFeatures, updateCharacterData]);


    const handleNext = () => {
        if (isStepValid) {
            // Determine if spellcasting step should be shown
            const isSpellcaster = characterData.features?.some(f => f.metadata?.effectType === 'spellcastingGrant');
            let nextStep = currentStep + 1;

            // Skip Step 8 (Spells) if not a spellcaster OR if in edit mode (handle spell editing separately if needed)
             if (currentStep === TOTAL_STEPS - 1 && (!isSpellcaster || editMode)) {
                 nextStep = TOTAL_STEPS; // Go directly to review if skipping spells
             }

            setCurrentStep(prev => Math.min(nextStep, TOTAL_STEPS));
            setIsStepValid(false); // Reset validity for the next step
        } else {
            toast({ variant: 'destructive', title: 'Incomplete Step', description: 'Please complete the required fields or selections for this step.' });
        }
    };

    const handleBack = () => {
         let prevStep = currentStep - 1;
         // Skip Step 8 (Spells) backwards if not a spellcaster OR if in edit mode
          const isSpellcaster = characterData.features?.some(f => f.metadata?.effectType === 'spellcastingGrant');
          if (currentStep === TOTAL_STEPS && (!isSpellcaster || editMode)) {
               prevStep = TOTAL_STEPS - 2; // Skip back over spells step
          }

        setCurrentStep(prev => Math.max(1, prevStep));
        setIsStepValid(true); // Assume previous step was valid
    };

    const handleSubmit = async () => {
        if (!user) {
             toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to save a character.' });
             return;
        }

        setApiError(null);
        setIsLoading(true);

        // Prepare final character data for saving
        const finalData: Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'stats' | 'spellcasting'> & { baseStats?: Partial<Character['baseStats']> } = {
            playerId: user.uid,
            playerName: characterData.playerName || 'Unknown Player',
            characterName: characterData.characterName || 'Unnamed Character',
            race: characterData.race || 'Unknown Race',
            class: characterData.class || 'Unknown Class', // Assuming single class for now
            level: characterData.level || 1,
            background: characterData.background || 'Unknown Background',
            alignment: characterData.alignment || 'Neutral',
            baseStats: characterData.stats, // Save base stats
            skills: characterData.skills || {},
            hitPoints: characterData.hitPoints || { max: 0, current: 0, temporary: 0 },
            hitDice: characterData.hitDice || { total: 1, remaining: 1, dieType: null },
            equipment: characterData.equipment || [],
            proficiencies: characterData.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [], languages: [] },
            features: characterData.features || [],
            featureChoices: characterData.featureChoices || {},
            spellsKnown: characterData.spellsKnown || [],
            spellsPrepared: characterData.spellsPrepared || [],
            backstory: characterData.backstory || '',
            appearance: characterData.appearance || '',
            campaignId: characterData.campaignId,
        };

        try {
            let result;
            if (editMode && initialData?.id) {
                // Update existing character
                result = await updateCharacterAction(initialData.id, finalData, user.uid);
            } else {
                // Save new character
                result = await saveCharacterAction(finalData as any, user.uid); // Need to cast as Omit<...>
            }

            if (result.success) {
                toast({
                    title: editMode ? 'Character Updated' : 'Character Created',
                    description: `${finalData.characterName} has been saved successfully.`,
                });
                const characterId = editMode ? initialData?.id : result.characterId;
                router.push(characterId ? `/character/view/${characterId}` : '/'); // Redirect to view or list
                router.refresh();
            } else {
                throw new Error(result.error || 'An unknown error occurred.');
            }
        } catch (error: any) {
            setApiError(error.message || 'Failed to save character.');
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };


    const renderStep = () => {
        // Check if essential data is still loading
        const isFetchingInitialData = isLoadingRaces || isLoadingClasses || isLoadingBackgrounds || isLoadingItems || isLoadingSpells;

        switch (currentStep) {
            case 1:
                return <Step1BasicInfo data={characterData} updateData={updateCharacterData} setValidity={setIsStepValid} />;
            case 2:
                 return <Step2RaceSelection data={characterData} updateData={updateCharacterData} setValidity={setIsStepValid} availableRaces={availableRaces} isLoading={isLoadingRaces} />;
            case 3:
                 return <Step3ClassSelection data={characterData} updateData={updateCharacterData} setValidity={setIsStepValid} availableClasses={availableClasses} isLoading={isLoadingClasses} />;
            case 4:
                return <Step4AbilityScores data={characterData} updateData={updateCharacterData} setValidity={setIsStepValid} />;
            case 5:
                 return <Step5Background data={characterData} updateData={updateCharacterData} setValidity={setIsStepValid} availableBackgrounds={availableBackgrounds} isLoading={isLoadingBackgrounds} campaignId={campaignId} />;
            case 6:
                 return <Step6Equipment data={characterData} updateData={updateCharacterData} setValidity={setIsStepValid} availableItems={availableItems} isLoading={isLoadingItems} availableClasses={availableClasses} availableBackgrounds={availableBackgrounds} />;
            case 7:
                 // Determine if spells step should be shown based on features
                  const isSpellcaster = characterData.features?.some(f => f.metadata?.effectType === 'spellcastingGrant');
                  if (isSpellcaster && !editMode) { // Show spells only if spellcaster and not in edit mode (for simplicity)
                       return <Step8Spells
                                data={characterData}
                                updateData={updateCharacterData}
                                setValidity={setIsStepValid}
                                availableSpells={availableSpells} // Pass spells
                                availableClasses={availableClasses} // Pass class info
                                isLoadingSpells={isLoadingSpells}
                            />;
                  }
                  // Skip spell step in edit mode or if not a spellcaster
                  if (currentStep === 7) { // Use 7 because step increments after render potentially
                     setCurrentStep(prev => prev + 1); // Auto-advance if skipped
                     return <Loader2 className="h-8 w-8 animate-spin text-center mx-auto" />; // Show loader briefly
                  }
                  // Fallthrough to review if spell step was skipped incorrectly (shouldn't happen)
                 return <Step7Review characterData={characterData} />;
             case 8:
                 return <Step7Review characterData={characterData} />; // Review is now step 8 if spells included

            default:
                return <div>Invalid Step</div>;
        }
    };

    const progress = (currentStep / TOTAL_STEPS) * 100;
    const finalStepNumber = TOTAL_STEPS; // Review is always the last step conceptually

    const isFetchingInitialData = isLoadingRaces || isLoadingClasses || isLoadingBackgrounds || isLoadingItems || isLoadingSpells;


    if (isFetchingInitialData && !initialData) { // Show loader only on initial create load
        return (
            <div className="space-y-4 p-4 md:p-6">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-64 w-full" />
                <div className="flex justify-between">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>
        );
    }


     // Determine the actual final step number, considering the spell step skip
     const isSpellcasterForFinalStep = characterData.features?.some(f => f.metadata?.effectType === 'spellcastingGrant');
     const actualTotalSteps = (isSpellcasterForFinalStep && !editMode) ? TOTAL_STEPS : TOTAL_STEPS - 1;


    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">{editMode ? 'Edit Character' : 'Create New Character'} - Step {currentStep} of {actualTotalSteps}</h1>
            <Progress value={progress} className="w-full mb-6" />

            {apiError && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{apiError}</AlertDescription>
                </Alert>
            )}

            <div className="min-h-[400px]"> {/* Ensure container has min height */}
                 {renderStep()}
             </div>


            <div className="flex justify-between mt-8">
                <Button
                    onClick={handleBack}
                    disabled={currentStep === 1 || isLoading}
                    variant="outline"
                >
                    Back
                </Button>
                {currentStep < actualTotalSteps ? (
                    <Button
                        onClick={handleNext}
                        disabled={!isStepValid || isLoading}
                    >
                        Next
                    </Button>
                ) : (
                    <Button
                        onClick={handleSubmit}
                        disabled={!isStepValid || isLoading} // Ensure final step is also valid before submitting
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editMode ? 'Update Character' : 'Finish & Save Character'}
                    </Button>
                )}
            </div>
        </div>
    );
}
