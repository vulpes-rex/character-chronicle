
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveCharacter } from '@/services/character-service';
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

const TOTAL_STEPS = 6;

export function CharacterCreationWizard() {
    const [currentStep, setCurrentStep] = useState(1);
    const [characterData, setCharacterData] = useState<PartialCharacterFormData>({
        playerName: '',
        characterName: '',
        race: '',
        class: '', // Primary class for now
        level: 1,
        background: '',
        alignment: '',
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        skills: ALL_SKILLS.reduce((acc, skill) => { acc[skill] = false; return acc; }, {} as Record<string, boolean>),
        equipment: [],
        backstory: '',
        appearance: '',
        selectedClasses: {}, // Initialize for multi-classing
        tempFeatures: [],
        tempProficiencies: { armor: [], weapons: [], tools: [], savingThrows: [] },
    });
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

    const updateCharacterData = (newData: PartialCharacterFormData) => {
        setCharacterData(prev => ({ ...prev, ...newData }));
    };

    const handleNext = () => {
        if (isValid) {
            setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
            setIsValid(false); // Reset validity for the next step
        } else {
            toast({ variant: 'destructive', title: 'Incomplete Step', description: 'Please complete the required fields.' });
        }
    };

    const handlePrevious = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
        setIsValid(true); // Assume previous step was valid
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
             // --- Final Data Calculation ---
             const finalLevel = Object.values(characterData.selectedClasses ?? {}).reduce((sum, lvl) => sum + lvl, 0) || 1;
             const primaryClass = Object.keys(characterData.selectedClasses ?? {})[0] ?? characterData.class ?? ''; // Determine primary class
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

                 if (index === 0) { // First class determines initial HP and hit die type
                      maxHp = classHitDieSides + conModifier;
                      hitDice.dieType = classData.hitDie;
                      if (level > 1) {
                          maxHp += (level - 1) * (Math.ceil((classHitDieSides + 1) / 2) + conModifier);
                      }
                 } else { // Subsequent classes add their HP
                     for (let i = 0; i < level; i++) {
                          maxHp += Math.ceil((classHitDieSides + 1) / 2) + conModifier;
                     }
                 }
             });
             maxHp = Math.max(1, maxHp); // Ensure minimum 1 HP

             const finalHitPoints: HitPointsState = { max: maxHp, current: maxHp, temporary: 0 };

             // Final Skill Proficiencies (ensure boolean values)
            const finalSkills: Record<string, boolean> = {};
            ALL_SKILLS.forEach(skill => {
                finalSkills[skill] = !!characterData.skills?.[skill];
            });

             // Construct final Character object
            const characterToSave: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> = {
                playerName: characterData.playerName || '',
                characterName: characterData.characterName || '',
                race: characterData.race || '',
                class: primaryClass, // Store primary class or handle representation differently
                level: finalLevel,
                background: characterData.background || '',
                alignment: characterData.alignment || '',
                stats: { // Ensure all stats are present
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
                equipment: (characterData.equipment as EquipmentItem[])?.map(item => ({ // Ensure full equipment structure
                     ...item,
                     quantity: item.quantity ?? 1,
                     isEquipped: item.isEquipped ?? false,
                 })) || [],
                proficiencies: { // Use combined proficiencies
                     armor: characterData.tempProficiencies?.armor ?? [],
                     weapons: characterData.tempProficiencies?.weapons ?? [],
                     tools: characterData.tempProficiencies?.tools ?? [],
                     savingThrows: characterData.tempProficiencies?.savingThrows ?? [],
                 },
                features: characterData.tempFeatures || [], // Use combined features
                backstory: characterData.backstory || '',
                appearance: characterData.appearance || '',
                campaignId: undefined, // Or logic to assign later
            };

            const newId = await saveCharacter(characterToSave);
            toast({ title: 'Character Created', description: `${characterToSave.characterName} has been successfully created.` });
            router.push(`/character/view/${newId}`);
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
                return <Step1BasicInfo data={characterData} updateData={updateCharacterData} setValidity={setIsValid} />;
            case 2:
                return <Step2RaceSelection data={characterData} updateData={updateCharacterData} setValidity={setIsValid} availableRaces={availableRaces} />;
            case 3:
                return <Step3ClassSelection data={characterData} updateData={updateCharacterData} setValidity={setIsValid} availableClasses={availableClasses} />;
            case 4:
                return <Step4AbilityScores data={characterData} updateData={updateCharacterData} setValidity={setIsValid} availableRaces={availableRaces}/>;
            case 5:
                return <Step5Background data={characterData} updateData={updateCharacterData} setValidity={setIsValid} />;
            case 6:
                return <Step6Equipment data={characterData} updateData={updateCharacterData} setValidity={setIsValid} />;
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
            <h1 className="text-3xl font-bold mb-6">Create New Character (Step {currentStep} of {TOTAL_STEPS})</h1>
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
                        Finish & Create Character
                    </Button>
                )}
            </div>
        </div>
    );
}
