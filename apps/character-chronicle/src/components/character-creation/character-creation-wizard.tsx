'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button'; // Use alias
import { useToast } from '@/hooks/use-toast'; // Use alias
import { useRouter } from 'next/navigation';
import { saveCharacterAction, updateCharacterAction } from '@/app/actions/character-actions'; // Use Server Actions
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, CharacterClass as CharacterClassType, SourcePack, BackgroundInfo, CharacterRace, Spell } from '@/lib/types'; // Use alias
import { getCharacterClassesAction, getCharacterRacesAction, getAvailableEquipmentItemsAction, getAvailableBackgroundsAction, getBackgroundDetailsAction, getSpellsAction } from '@/app/actions/dnd-api-actions'; // Use Server Actions
import { getBackgroundFeaturesAction, getClassFeaturesAction, getRaceFeaturesAction, applyFeatureRulesAction } from '@/app/actions/feature-actions'; // Use Server Actions
import { calculateSkillModifier, SKILL_ABILITY_MAP, ALL_SKILLS, rollDice } from '@/lib/types'; // Import type helpers directly
import { Progress } from '@/components/ui/progress'; // Use alias
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Use alias
import { AlertCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton'; // Use alias
import { useAuth } from '@/components/auth-provider'; // Import useAuth hook

// Import step components
import { Step1BasicInfo } from './step-1-basic-info';
import { Step2RaceSelection } from './step-2-race-selection';
import { Step3ClassSelection } from './step-3-class-selection';
import { Step4AbilityScores } from './step-4-ability-scores';
import { Step5Background } from './step-5-background';
import { Step6Equipment } from './step-6-equipment';
import { Step7FeatureChoices } from './step-7-feature-choices'; // Import Step 7
import { Step8Review } from './step-8-review'; // Import Step 8 (Review)

// Total number of steps in the wizard
const TOTAL_STEPS = 8; // 7 steps + Review

// Partial type for form data across steps
export type PartialCharacterFormData = Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'stats' | 'spellcasting'>> & {
    stats?: Partial<Character['baseStats']>; // Use baseStats during creation/edit
    featureChoices?: Record<string, string | string[]>; // Store feature choices
    // Add temporary fields if needed during creation that aren't directly on Character model
    selectedClassLevels?: Record<string, number>; // For multiclassing levels
    // Temporary fields to hold derived data before final calculation if needed
    _calculatedFeatures?: Feature[];
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
            featureChoices: initialData.featureChoices || {}, // Load existing choices
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
            featureChoices: {}, // Initialize feature choices
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


    // Calculate features based on current selections (Memoized)
     const calculatedFeatures = useMemo(() => {
         let features: Feature[] = [];
         // Add race features (assuming these are static based on race name)
         const raceDef = availableRaces.find(r => r.name === characterData.race);
         if (raceDef?.traits) {
             // TODO: Fetch actual feature definitions based on trait keys
             // features.push(...getRaceFeatures(raceDef.traits));
         }

         // Add class features (cumulative up to selected levels)
         if (characterData.selectedClassLevels) {
             Object.entries(characterData.selectedClassLevels).forEach(([className, level]) => {
                 // TODO: Fetch actual class features based on className and level
                 // features.push(...getClassFeatures(className, level));
             });
         }

         // Add background features
         if (characterData.background) {
             // TODO: Fetch actual background features
             // features.push(...getBackgroundFeatures(characterData.background));
         }

         // Combine and unique (simple example)
          const uniqueFeatures = [...new Map(features.map(f => [f.name, f])).values()];
          return uniqueFeatures;
     }, [characterData.race, characterData.selectedClassLevels, characterData.background, availableRaces]); // Dependencies

    // Update features in main state whenever calculated features change
    useEffect(() => {
         // updateCharacterData({ features: calculatedFeatures });
          // Use _calculatedFeatures to avoid direct update loop? Or handle carefully.
           setCharacterData(prev => ({ ...prev, _calculatedFeatures: calculatedFeatures }));
    }, [calculatedFeatures]); // Removed updateCharacterData dependency


    const handleNext = () => {
        if (isStepValid) {
            setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
            setIsStepValid(false); // Reset validity for the next step
        } else {
            toast({ variant: 'destructive', title: 'Incomplete Step', description: 'Please complete the required fields or selections for this step.' });
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(1, prev - 1));
        setIsStepValid(true); // Assume previous step was valid
    };

    const handleSubmit = async () => {
        if (!user) {
             toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to save a character.' });
             return;
        }
        if (!isStepValid && currentStep === TOTAL_STEPS) { // Check validity on the final (review) step
             toast({ variant: 'destructive', title: 'Review Needed', description: 'Please review the character details.' });
             // Or perhaps the review step is always considered "valid" once reached.
             // setValidity(true) could be called unconditionally in the review step's useEffect.
             // For now, let's assume the review step sets its own validity.
             return;
        }

        setApiError(null);
        setIsLoading(true);

        // Prepare final character data for saving - Use base stats and choices
        const baseData: Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'stats' | 'spellcasting' | 'proficiencies' | 'skills' | 'hitPoints' | 'hitDice'>> & { baseStats?: Partial<Character['baseStats']> } = {
            playerId: user.uid,
            playerName: characterData.playerName,
            characterName: characterData.characterName,
            race: characterData.race,
            class: characterData.class, // Assuming single class for now
            level: characterData.level,
            background: characterData.background,
            alignment: characterData.alignment,
            baseStats: characterData.stats, // Save base stats from Step 4
            equipment: characterData.equipment,
            features: characterData.features, // Save the collected features
            featureChoices: characterData.featureChoices, // Save choices
            spellsKnown: characterData.spellsKnown,
            spellsPrepared: characterData.spellsPrepared,
            backstory: characterData.backstory,
            appearance: characterData.appearance,
            campaignId: characterData.campaignId,
            // HP, Skills, Proficiencies, etc., will be calculated server-side on load/update based on features/class/level/stats
        };


        try {
            let result;
            if (editMode && initialData?.id) {
                // Update existing character
                result = await updateCharacterAction(initialData.id, baseData, user.uid);
            } else {
                // Save new character
                 // Ensure required fields are present before casting
                 if (!baseData.playerName || !baseData.characterName || !baseData.race || !baseData.class || !baseData.level || !baseData.background || !baseData.alignment || !baseData.baseStats) {
                      throw new Error("Missing required character information before saving.");
                 }
                result = await saveCharacterAction(baseData as Omit<Character, 'id' | 'createdAt' | 'updatedAt'>, user.uid);
            }

            if (result.success) {
                toast({
                    title: editMode ? 'Character Updated' : 'Character Created',
                    description: `${baseData.characterName} has been saved successfully.`,
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
                // Step 7: Feature Choices
                 return <Step7FeatureChoices data={characterData} updateData={updateCharacterData} setValidity={setIsStepValid} />;
             case 8:
                 // Step 8: Review
                 // Pass the potentially updated characterData with choices to Review step
                 return <Step8Review characterData={characterData} />;

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

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">{editMode ? 'Edit Character' : 'Create New Character'} - Step {currentStep} of {finalStepNumber}</h1>
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
                {currentStep < finalStepNumber ? (
                    <Button
                        onClick={handleNext}
                        disabled={!isStepValid || isLoading}
                    >
                        Next
                    </Button>
                ) : (
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !isStepValid} // Ensure final step is valid before submitting
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editMode ? 'Update Character' : 'Finish & Save Character'}
                    </Button>
                )}
            </div>
        </div>
    );
}
