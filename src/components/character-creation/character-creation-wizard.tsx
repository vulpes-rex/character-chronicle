
'use client';

import { useState, useCallback, useEffect } from 'react'; // Import useEffect
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveCharacter, updateCharacter } from '@/services/character-service'; // Import updateCharacter
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, CharacterClass as CharacterClassType } from '@/lib/types';
import { getCharacterClasses, getCharacterRaces, getCumulativeClassFeatures, getRaceTraitsDetails, getAvailableEquipmentItems, getBackgroundDetails } from '@/services/dnd-api';
import { calculateSkillModifier, SKILL_ABILITY_MAP, ALL_SKILLS, rollDice } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
    equipment: char.equipment as Partial<EquipmentItem>[], // Cast needed
    backstory: char.backstory,
    appearance: char.appearance,
    // Reconstruct selectedClasses from primary class and level for simplicity in editing single class
    // TODO: Handle multiclass editing properly if needed
    selectedClasses: { [char.class]: char.level },
    tempFeatures: char.features,
    tempProficiencies: char.proficiencies,
});

interface CharacterCreationWizardProps {
    initialData?: Character; // Optional initial data for editing
    editMode?: boolean; // Flag for edit mode
}

export function CharacterCreationWizard({ initialData, editMode = false }: CharacterCreationWizardProps) {
    const TOTAL_STEPS = editMode ? 5 : 6; // Skip equipment step in edit mode
    const [currentStep, setCurrentStep] = useState(1);
    // Initialize state with initialData if provided, otherwise default empty state
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
        }
    );
    const [isValid, setIsValid] = useState(false); // Track if current step data is valid
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    // Fetch data needed across steps
    const { data: availableClasses = [], isLoading: isLoadingClasses } = useQuery<CharacterClassType[], Error>({
        queryKey: ['characterClasses'],
        queryFn: getCharacterClasses,
        staleTime: Infinity,
    });

    const { data: availableRaces = [], isLoading: isLoadingRaces } = useQuery<Awaited<ReturnType<typeof getCharacterRaces>>, Error>({
        queryKey: ['characterRaces'],
        queryFn: getCharacterRaces,
        staleTime: Infinity,
    });

    const isFetchingInitialData = isLoadingClasses || isLoadingRaces;

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
        setIsLoading(true);
        setApiError(null);

        try {
             // --- Final Data Calculation (Same as creation for now) ---
             const finalLevel = Object.values(characterData.selectedClasses ?? {}).reduce((sum, lvl) => sum + lvl, 0) || 1;
             const primaryClass = Object.keys(characterData.selectedClasses ?? {})[0] ?? characterData.class ?? '';
             const selectedClassData = availableClasses.find(c => c.name === primaryClass);

             if (!characterData.race || !primaryClass || !selectedClassData) {
                throw new Error("Core character information (race, class) is missing.");
             }

             const proficiencyBonus = calculateProficiencyBonus(finalLevel);
             const conModifier = Math.floor(((characterData.stats?.constitution ?? 10) - 10) / 2);

             // Recalculate HP based on final multiclass levels
             let maxHp = 0;
             let hitDice: HitDiceState = { total: finalLevel, remaining: finalLevel, dieType: null };

             // Calculate HP level by level for multiclassing
             Object.entries(characterData.selectedClasses ?? {}).forEach(([className, level], index) => {
                 const classData = availableClasses.find(c => c.name === className);
                 if (!classData) return;

                 const classHitDieSides = parseInt(classData.hitDie.substring(1), 10);

                 if (index === 0) {
                      maxHp = classHitDieSides + conModifier;
                      hitDice.dieType = classData.hitDie;
                      if (level > 1) {
                          maxHp += (level - 1) * (Math.ceil((classHitDieSides + 1) / 2) + conModifier);
                      }
                 } else {
                     for (let i = 0; i < level; i++) {
                          maxHp += Math.ceil((classHitDieSides + 1) / 2) + conModifier;
                     }
                 }
             });
             maxHp = Math.max(1, maxHp);

             // Keep existing current/temp HP if editing, otherwise start full
             const finalHitPoints: HitPointsState = {
                 max: maxHp,
                 current: initialData?.hitPoints?.current ?? maxHp,
                 temporary: initialData?.hitPoints?.temporary ?? 0,
             };

             // Keep existing remaining hit dice if editing
             hitDice.remaining = initialData?.hitDice?.remaining ?? finalLevel;

             // Final Skill Proficiencies
            const finalSkills: Record<string, boolean> = {};
            ALL_SKILLS.forEach(skill => {
                finalSkills[skill] = !!characterData.skills?.[skill];
            });

            // Construct final Character object (or partial for update)
            // Note: When updating, only send changed fields if possible, but for simplicity sending most fields.
            const characterToSave: Partial<Omit<Character, 'id' | 'createdAt'>> & {id?: string} = {
                id: initialData?.id, // Include ID for update
                playerName: characterData.playerName || '',
                characterName: characterData.characterName || '',
                race: characterData.race || '',
                class: primaryClass,
                level: finalLevel,
                background: characterData.background || '',
                alignment: characterData.alignment || '',
                stats: {
                    strength: characterData.stats?.strength ?? 10,
                    dexterity: characterData.stats?.dexterity ?? 10,
                    constitution: characterData.stats?.constitution ?? 10,
                    intelligence: characterData.stats?.intelligence ?? 10,
                    wisdom: characterData.stats?.wisdom ?? 10,
                    charisma: characterData.stats?.charisma ?? 10,
                },
                skills: finalSkills,
                hitPoints: finalHitPoints,
                hitDice: hitDice,
                // Only include equipment if NOT editing or if it's the last step in creation mode
                ...(!editMode && currentStep === TOTAL_STEPS && { equipment: (characterData.equipment as EquipmentItem[])?.map(item => ({
                     ...item,
                     quantity: item.quantity ?? 1,
                     isEquipped: item.isEquipped ?? false,
                 })) || [] }),
                 // If editing, equipment might be managed elsewhere (character sheet) or loaded initially
                 ...(editMode && initialData?.equipment && { equipment: initialData.equipment }),
                proficiencies: {
                     armor: characterData.tempProficiencies?.armor ?? [],
                     weapons: characterData.tempProficiencies?.weapons ?? [],
                     tools: characterData.tempProficiencies?.tools ?? [],
                     savingThrows: characterData.tempProficiencies?.savingThrows ?? [],
                 },
                features: characterData.tempFeatures || [],
                backstory: characterData.backstory || '',
                appearance: characterData.appearance || '',
                campaignId: initialData?.campaignId, // Preserve campaign ID if editing
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
        switch (currentStep) {
            case 1:
                return <Step1BasicInfo data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} />;
            case 2:
                return <Step2RaceSelection data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableRaces={availableRaces} />;
            case 3:
                return <Step3ClassSelection data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableClasses={availableClasses} />;
            case 4:
                return <Step4AbilityScores data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableRaces={availableRaces}/>;
            case 5:
                return <Step5Background data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} />;
            case 6: // Only shown in creation mode
                 if (!editMode) {
                    return <Step6Equipment data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} />;
                 }
                 // Fall through or return null if step 6 is reached in edit mode (shouldn't happen with TOTAL_STEPS adjustment)
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
                    <Button onClick={handleNext} disabled={!isValid || isLoading}>
                        Next
                    </Button>
                ) : (
                    <Button onClick={handleFinalSubmit} disabled={!isValid || isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editMode ? 'Save Changes' : 'Finish & Create Character'}
                    </Button>
                )}
            </div>
        </div>
    );
}
