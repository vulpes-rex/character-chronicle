
'use client';

import { useState, useCallback, useEffect } from 'react'; // Import useEffect
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveCharacter, updateCharacter } from '@/services/character-service'; // Import updateCharacter
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, CharacterClass as CharacterClassType, SourcePack } from '@/lib/types';
import { getCharacterClasses, getCharacterRaces, getCumulativeClassFeatures, getRaceTraitsDetails, getAvailableEquipmentItems, getBackgroundDetails } from '@/services/dnd-api'; // Removed getBackgroundFeatures
import { calculateSkillModifier, SKILL_ABILITY_MAP, ALL_SKILLS, rollDice } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getCombinedContentFromPacks } from '@/services/campaign-service'; // Import function to get combined content
import { applyFeatureRules, getBackgroundFeatures, getRaceFeatures } from '@/services/feature-service'; // Import feature application service & getBackgroundFeatures

// Import step components
import { Step1BasicInfo } from './step-1-basic-info';
import { Step2RaceSelection } from './step-2-race-selection';
import { Step3ClassSelection } from './step-3-class-selection';
import { Step4AbilityScores } from './step-4-ability-scores';
import { Step5Background } from './step-5-background';
import { Step6Equipment } from './step-6-equipment';

export type PartialCharacterFormData = Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'hitPoints' | 'hitDice' | 'features' | 'proficiencies' | 'skills' | 'equipment'> & {
    // Allow nested partials for stats and equipment
    stats?: Partial<Character['stats']>;
    equipment?: Partial<EquipmentItem>[];
    skills?: Partial<Record<string, boolean>>;
    selectedClasses?: { [key: string]: number }; // Track selected classes and levels
    tempFeatures?: Feature[]; // Temporary holding for features
    tempProficiencies?: Partial<Character['proficiencies']>; // Temporary holding for proficiencies
    activeSourcePackIds?: string[]; // Track selected source packs (relevant if selectable during creation)
}>;

// Helper to map full Character to PartialCharacterFormData for initialization
const mapCharacterToFormData = (char: Character): PartialCharacterFormData => ({
    playerName: char.playerName,
    characterName: char.characterName,
    race: char.race,
    class: char.class,
    level: char.level,
    background: char.background,
    alignment: char.alignment,
    stats: char.stats,
    skills: char.skills,
    equipment: (char.equipment as Partial<EquipmentItem>[])?.map(item => ({ ...item, name: item.name, quantity: item.quantity ?? 1})) || [], // Ensure name and quantity are present
    backstory: char.backstory,
    appearance: char.appearance,
    selectedClasses: { [char.class]: char.level }, // Simple single class representation
    tempFeatures: char.features,
    tempProficiencies: char.proficiencies,
    // activeSourcePackIds: char.campaignId ? (await loadCampaign(char.campaignId))?.activeSourcePackIds : ['srd'], // Needs async logic if loading campaign packs
    activeSourcePackIds: ['srd'], // Default or needs fetching based on context
});


interface CharacterCreationWizardProps {
    initialData?: Character; // Optional initial data for editing
    editMode?: boolean; // Flag for edit mode
}

export function CharacterCreationWizard({ initialData, editMode = false }: CharacterCreationWizardProps) {
    const TOTAL_STEPS = editMode ? 5 : 6; // Skip equipment step in edit mode
    const [currentStep, setCurrentStep] = useState(1);
    const [characterData, setCharacterData] = useState<PartialCharacterFormData>(
        initialData ? mapCharacterToFormData(initialData) : {
            playerName: '',
            characterName: '',
            race: '',
            class: '',
            level: 1,
            background: '',
            alignment: '',
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            skills: ALL_SKILLS.reduce((acc, skill) => { acc[skill] = false; return acc; }, {} as Record<string, boolean>),
            equipment: [],
            backstory: '',
            appearance: '',
            selectedClasses: {},
            tempFeatures: [],
            tempProficiencies: { armor: [], weapons: [], tools: [], savingThrows: [] },
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

    const isFetchingInitialData = isLoadingContent || isLoadingClasses || isLoadingRaces;

    // Memoize updateCharacterData to prevent re-renders in child components
     const updateCharacterData = useCallback((newData: Partial<PartialCharacterFormData>) => {
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

    const calculateProficiencyBonus = (level: number): number => {
        if (level >= 17) return 6;
        if (level >= 13) return 5;
        if (level >= 9) return 4;
        if (level >= 5) return 3;
        return 2;
    };

    const handleFinalSubmit = async () => {
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
             // --- Re-calculate final derived data based on choices ---
             const finalLevel = Object.values(characterData.selectedClasses ?? {}).reduce((sum, lvl) => sum + lvl, 0) || 1;
             const primaryClassKey = Object.keys(characterData.selectedClasses ?? {})[0] ?? characterData.class ?? '';
             const primaryClassData = combinedContent.classes?.[primaryClassKey];

             if (!characterData.race || !primaryClassKey || !primaryClassData) {
                throw new Error("Core character information (race, class) is missing or invalid in content packs.");
             }

            // Fetch final features based on race and class/level choices
            const raceFeatures = await getRaceFeatures(characterData.race, combinedContent);
            const classFeatures = await getCumulativeClassFeatures(primaryClassKey, finalLevel, combinedContent);
            const backgroundFeatures = characterData.background ? await getBackgroundFeatures(characterData.background, combinedContent) : [];
            const allBaseFeatures = [...raceFeatures, ...classFeatures, ...backgroundFeatures];

             // Construct a temporary full Character object with BASE data to apply effects
             const baseCharacterForCalc: Character = {
                 // Use base values from the form state
                 id: initialData?.id || 'temp-calc-id', // Temporary ID for calculation
                 playerName: characterData.playerName || '',
                 characterName: characterData.characterName || '',
                 race: characterData.race || '',
                 class: primaryClassKey,
                 level: finalLevel,
                 background: characterData.background || '',
                 alignment: characterData.alignment || '',
                 stats: characterData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
                 skills: characterData.skills || {}, // Base skill choices from form
                 hitPoints: { max: 0, current: 0, temporary: 0 }, // Will be calculated
                 hitDice: { total: finalLevel, remaining: finalLevel, dieType: primaryClassData.hitDie }, // Set die type
                 equipment: (characterData.equipment as EquipmentItem[])?.map(item => ({ // Ensure full item structure
                     ...item,
                     name: item.name || 'Unnamed Item', // Ensure name exists
                     quantity: item.quantity ?? 1,
                     isEquipped: item.isEquipped ?? false,
                 })) || [],
                 proficiencies: characterData.tempProficiencies || { armor: [], weapons: [], tools: [], savingThrows: [] }, // Base proficiencies from form steps
                 features: allBaseFeatures, // Use freshly fetched features
                 backstory: characterData.backstory || '',
                 appearance: characterData.appearance || '',
             };

              // Apply feature effects to get final calculated values
              const derivedCharacter = await applyFeatureRules(baseCharacterForCalc); // Renamed function call


             // Recalculate HP based on final CON and class levels
             const finalConModifier = Math.floor(((derivedCharacter.stats.constitution ?? 10) - 10) / 2);
             let finalMaxHp = 0;
             let finalHitDice: HitDiceState = { ...derivedCharacter.hitDice, total: finalLevel, remaining: finalLevel }; // Start with correct total/remaining

            Object.entries(characterData.selectedClasses ?? {}).forEach(([className, level], index) => {
                const classData = combinedContent.classes?.[className];
                if (!classData) return;
                const classHitDieSides = parseInt(classData.hitDie.substring(1), 10);

                if (index === 0) { // First class
                    finalMaxHp = classHitDieSides + finalConModifier;
                     finalHitDice.dieType = classData.hitDie; // Ensure primary hit die is set
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
                 current: initialData?.hitPoints?.current ?? finalMaxHp, // Preserve current HP if editing
                 temporary: initialData?.hitPoints?.temporary ?? 0, // Preserve temp HP if editing
             };
             finalHitDice.remaining = initialData?.hitDice?.remaining ?? finalLevel; // Preserve remaining dice if editing


            // Construct final Character object for saving
            const characterToSave: Partial<Omit<Character, 'id' | 'createdAt'>> & {id?: string} = {
                id: initialData?.id,
                playerName: derivedCharacter.playerName,
                characterName: derivedCharacter.characterName,
                race: derivedCharacter.race,
                class: derivedCharacter.class,
                level: derivedCharacter.level,
                background: derivedCharacter.background,
                alignment: derivedCharacter.alignment,
                stats: derivedCharacter.stats, // Save the final base stats (potentially affected by features)
                skills: derivedCharacter.skills, // Save final skill proficiency map
                hitPoints: finalHitPoints, // Save calculated HP
                hitDice: finalHitDice, // Save calculated Hit Dice
                equipment: derivedCharacter.equipment,
                proficiencies: derivedCharacter.proficiencies, // Save final calculated proficiencies
                features: derivedCharacter.features, // Save final list of features
                backstory: derivedCharacter.backstory,
                appearance: derivedCharacter.appearance,
                campaignId: initialData?.campaignId,
            };

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
            setApiError(error instanceof Error ? error.message : 'An unknown error occurred during saving.');
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save character.' });
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
                return <Step2RaceSelection data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableRaces={availableRaces} combinedContent={combinedContent} />;
            case 3:
                return <Step3ClassSelection data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableClasses={availableClasses} combinedContent={combinedContent} />;
            case 4:
                return <Step4AbilityScores data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableRaces={availableRaces}/>;
            case 5:
                return <Step5Background data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} combinedContent={combinedContent} />;
            case 6: // Only shown in creation mode
                 if (!editMode) {
                    return <Step6Equipment data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} combinedContent={combinedContent} />;
                 }
                 return <div>Invalid Step for Edit Mode</div>;
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

    