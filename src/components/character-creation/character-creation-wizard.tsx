

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveCharacter, updateCharacter } from '@/services/character-service'; // Import updateCharacter
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, CharacterClass as CharacterClassType, SourcePack } from '@/lib/types';
import { getCharacterClasses, getCharacterRaces, getAvailableEquipmentItems, getBackgroundDetails } from '@/services/dnd-api'; // Keep base data fetchers
import { getBackgroundFeatures, getRaceFeatures, getClassFeatures } from '@/services/feature-service'; // Import feature service
import { calculateSkillModifier, SKILL_ABILITY_MAP, ALL_SKILLS, rollDice } from '@/lib/types';
import { useQuery, useQueries } from '@tanstack/react-query'; // Use useQuery and useQueries
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
    stats?: Partial<Character['stats']>;
    equipment?: Partial<EquipmentItem>[];
    skills?: Partial<Record<string, boolean>>;
    selectedClasses?: { [key: string]: number };
    featureChoices?: Record<string, string | string[]>;
    activeSourcePackIds?: string[];
}>;

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
    equipment: (char.equipment as Partial<EquipmentItem>[])?.map(item => ({ ...item, name: item.name, quantity: item.quantity ?? 1 })) || [],
    backstory: char.backstory,
    appearance: char.appearance,
    selectedClasses: char.class ? { [char.class]: char.level } : {},
    featureChoices: char.featureChoices || {},
    activeSourcePackIds: ['srd'], // Default or needs fetching
});


interface CharacterCreationWizardProps {
    initialData?: Character;
    editMode?: boolean;
}

export function CharacterCreationWizard({ initialData, editMode = false }: CharacterCreationWizardProps) {
    const TOTAL_STEPS = editMode ? 6 : 7;
    const [currentStep, setCurrentStep] = useState(1);
    const [characterData, setCharacterData] = useState<PartialCharacterFormData>(
        initialData ? mapCharacterToFormData(initialData) : {
            playerName: '',
            characterName: '',
            race: '',
            level: 1,
            background: '',
            alignment: '',
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            skills: ALL_SKILLS.reduce((acc, skill) => { acc[skill] = false; return acc; }, {} as Record<string, boolean>),
            equipment: [],
            backstory: '',
            appearance: '',
            selectedClasses: {},
            featureChoices: {},
            activeSourcePackIds: ['srd'],
        }
    );
    const [isValid, setIsValid] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    // Fetch combined content
    const { data: combinedContent, isLoading: isLoadingContent } = useQuery<SourcePack['content'], Error>({
        queryKey: ['combinedContent', characterData.activeSourcePackIds],
        queryFn: () => getCombinedContentFromPacks(characterData.activeSourcePackIds || ['srd']),
        staleTime: 5 * 60 * 1000,
        enabled: true,
    });

    // Fetch base data (classes, races)
    const { data: availableClasses = [], isLoading: isLoadingClasses } = useQuery<CharacterClassType[], Error>({
        queryKey: ['characterClasses', combinedContent],
        queryFn: () => getCharacterClasses(combinedContent),
        enabled: !!combinedContent,
        staleTime: Infinity,
    });

    const { data: availableRaces = [], isLoading: isLoadingRaces } = useQuery<CharacterRace[], Error>({
        queryKey: ['characterRaces', combinedContent],
        queryFn: () => getCharacterRaces(combinedContent),
        enabled: !!combinedContent,
        staleTime: Infinity,
    });

    // --- Fetch all relevant features based on selections ---
     const selectedRace = characterData.race;
     const selectedBg = characterData.background;
     const selectedClassEntries = Object.entries(characterData.selectedClasses ?? {});

     // Fetch race features
     const { data: raceFeatures = [], isLoading: isLoadingRaceFeatures } = useQuery<Feature[], Error>({
         queryKey: ['raceFeatures', selectedRace, combinedContent],
         queryFn: () => selectedRace && combinedContent ? getRaceFeatures(selectedRace, combinedContent) : Promise.resolve([]),
         enabled: !!selectedRace && !!combinedContent,
     });

     // Fetch background features
     const { data: backgroundFeatures = [], isLoading: isLoadingBgFeatures } = useQuery<Feature[], Error>({
         queryKey: ['backgroundFeatures', selectedBg, combinedContent],
         queryFn: () => selectedBg && combinedContent ? getBackgroundFeatures(selectedBg, combinedContent) : Promise.resolve([]),
         enabled: !!selectedBg && !!combinedContent,
     });

     // Fetch class features for each selected class/level pair
     const classFeatureQueries = useMemo(() => selectedClassEntries
         .filter(([_, level]) => level > 0)
         .map(([className, level]) => ({
             queryKey: ['classFeatures', className, level, combinedContent],
             queryFn: () => getClassFeatures(className, level, combinedContent!),
             enabled: !!combinedContent,
             staleTime: Infinity,
         })), [selectedClassEntries, combinedContent]);

     const classFeatureResults = useQueries({ queries: classFeatureQueries });
     const isLoadingClassFeatures = classFeatureResults.some(result => result.isLoading);
     const allClassFeatures = useMemo(() => classFeatureResults.flatMap(result => result.data ?? []), [classFeatureResults]);

     // Combine all features
     const allFeatures = useMemo(() => [...raceFeatures, ...backgroundFeatures, ...allClassFeatures], [raceFeatures, backgroundFeatures, allClassFeatures]);
     const isFetchingFeatures = isLoadingRaceFeatures || isLoadingBgFeatures || isLoadingClassFeatures;


    const isFetchingInitialData = isLoadingContent || isLoadingClasses || isLoadingRaces || isFetchingFeatures;


    // Update character data state
    const updateCharacterData = useCallback((newData: Partial<PartialCharacterFormData>) => {
       console.log("Wizard: Updating parent data with:", newData);
        setCharacterData(prev => {
            // Avoid unnecessary updates if data hasn't changed
             if (JSON.stringify({ ...prev, ...newData }) === JSON.stringify(prev)) {
                 return prev;
             }
            return { ...prev, ...newData };
        });
    }, []);


    // Set validity callback
     const setValidityCallback = useCallback((valid: boolean) => {
         setIsValid(valid);
     }, []);


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


    const handleFinalSubmit = async () => {
        console.log("Wizard: Final Submit Triggered. Current State:", characterData);
        if (!isValid) {
            toast({ variant: 'destructive', title: 'Incomplete Step', description: 'Please complete the final step.' });
            return;
        }
        if (!combinedContent || isFetchingInitialData) {
             toast({ variant: 'destructive', title: 'Data Error', description: 'Core content data or features are still loading. Cannot save character.' });
             return;
        }
        setIsLoading(true);
        setApiError(null);

        try {
             // --- Aggregate chosen data ---
             const finalLevel = Object.values(characterData.selectedClasses ?? {}).reduce((sum, lvl) => sum + lvl, 0) || 1;
             const primaryClassKey = Object.keys(characterData.selectedClasses || {})[0] || '';

              if (!characterData.race) throw new Error("Character race selection is missing.");
              if (!primaryClassKey) throw new Error("Character class selection is missing.");

            // --- Apply feature choices to the combined feature list ---
            // Feature choices modify the effective list of features
             const featuresWithChoicesApplied = allFeatures.map(feature => {
                 if (feature.metadata?.effectType === 'choiceGrant') {
                    const choiceKey = feature.metadata.choiceKey;
                    const choice = characterData.featureChoices?.[choiceKey];
                     if (choice && typeof choice === 'string' && feature.metadata.options.includes(choice)) {
                          // Attempt to find the specific feature definition based on the choice
                         // Assumes the choice name might directly map or form part of the specific feature name
                         const specificFeatureKey = `${feature.name}: ${choice}`; // Example convention
                         const specificFeatureDef = allFeatures.find(f => f.name === specificFeatureKey) || combinedContent?.features?.[specificFeatureKey];

                          if (specificFeatureDef) {
                             // Return the specific feature definition
                              return {
                                  ...specificFeatureDef,
                                  name: specificFeatureKey, // Ensure name reflects the choice
                                  source: feature.source,
                                  // Carry over other essential properties if needed
                              };
                          } else {
                             console.warn(`Specific definition for choice "${choice}" of feature "${feature.name}" not found.`);
                             // Return the original generic feature? Or filter it out?
                             // Return original for now, but mark it somehow?
                             return { ...feature, description: `${feature.description} (Chosen: ${choice})`};
                          }
                     } else {
                         // If no valid choice is made for a required choice feature, potentially filter it out
                          console.warn(`No valid choice made for feature "${feature.name}".`);
                         return null; // Indicate removal or invalid state
                     }
                 } else if (feature.metadata?.effectType === 'proficiencyGrant' && feature.metadata.choose && feature.metadata.options) {
                     const choiceKey = feature.metadata.choiceKey || feature.name;
                     const choices = characterData.featureChoices?.[choiceKey];
                     if (choices && Array.isArray(choices) && choices.length === feature.metadata.choose) {
                         // Modify the feature to reflect chosen proficiencies (for saving/reference)
                         return {
                             ...feature,
                             metadata: {
                                 ...feature.metadata,
                                 proficiencies: choices, // Store the chosen proficiencies directly in metadata for saving
                                 choose: undefined, // Indicate choice has been made
                                 options: undefined,
                             }
                         };
                     } else {
                         // If choice not made or invalid count, potentially filter out
                         console.warn(`Invalid or missing choices for proficiency feature "${feature.name}".`);
                         return null; // Indicate removal or invalid state
                     }
                 }
                 return feature; // Return other features unchanged
             }).filter((f): f is Feature => f !== null && f.metadata?.effectType !== 'choiceGrant'); // Filter out nulls and generic choiceGrant features


             // --- Calculate BASE Stats, HitPoints, HitDice (without derived rules applied yet) ---
             const baseStats = characterData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
             const statsAfterRacial = { ...baseStats }; // Start with stats potentially modified by Step 4

             // --- Calculate derived values based on final base stats and features ---
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
                const classData = availableClasses.find(c => c.name === className); // Use fetched class data
                if (!classData) return;
                const classHitDieSides = parseInt(classData.hitDie.substring(1), 10);
                if (index === 0) primaryHitDie = classData.hitDie;

                if (index === 0) {
                    finalMaxHp = classHitDieSides + finalConModifier;
                    if (level > 1) {
                        finalMaxHp += (level - 1) * (Math.ceil((classHitDieSides + 1) / 2) + finalConModifier);
                    }
                } else {
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

             // --- Build Base Proficiencies from Class/Background/Race ---
             // Note: applyFeatureRules service now handles merging these based on feature metadata
             const initialProficiencies = {
                 armor: [], weapons: [], tools: [], savingThrows: [], languages: [],
             };
             const initialSkills = ALL_SKILLS.reduce((acc, skill) => { acc[skill] = false; return acc; }, {} as Record<string, boolean>);


            // --- Construct final Character object for saving ---
            // IMPORTANT: Save BASE stats, chosen skills, features (including applied choices).
             const characterToSave: Partial<Omit<Character, 'id' | 'createdAt'>> & {id?: string} = {
                 id: initialData?.id,
                 playerName: characterData.playerName || '',
                 characterName: characterData.characterName || '',
                 race: characterData.race || '',
                 class: primaryClassKey,
                 level: finalLevel,
                 background: characterData.background || '',
                 alignment: characterData.alignment || '',
                 stats: statsAfterRacial, // Save the BASE stats (with racial adjustments from Step 4)
                 skills: characterData.skills || initialSkills, // Save the skill PROFICIENCY selections made
                 hitPoints: finalHitPoints,
                 hitDice: finalHitDice,
                 equipment: (characterData.equipment as EquipmentItem[])?.map(item => ({ // Ensure full item structure
                    name: item.name || 'Unnamed Item',
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
                 proficiencies: initialProficiencies, // Save INITIAL proficiencies; derived ones come from features
                 features: featuresWithChoicesApplied, // Save the *final* list of features after applying choices
                 featureChoices: characterData.featureChoices || {},
                 backstory: characterData.backstory || '',
                 appearance: characterData.appearance || '',
                 campaignId: initialData?.campaignId,
             };

            // Remove temporary or undefined fields before saving
            delete (characterToSave as any).selectedClasses;
            delete (characterToSave as any).activeSourcePackIds;

            if (editMode && initialData?.id) {
                await updateCharacter(initialData.id, characterToSave);
                toast({ title: 'Character Updated', description: `${characterToSave.characterName} has been successfully updated.` });
                router.push(`/character/view/${initialData.id}`);
                router.refresh();
            } else {
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
        switch (currentStep) {
            case 1:
                return <Step1BasicInfo data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} />;
            case 2:
                return <Step2RaceSelection data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableRaces={availableRaces} combinedContent={combinedContent} />;
            case 3:
                return <Step3ClassSelection data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableClasses={availableClasses} combinedContent={combinedContent} />;
            case 4:
                return <Step4AbilityScores data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} availableRaces={availableRaces} editMode={editMode} />;
            case 5:
                return <Step5Background data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} combinedContent={combinedContent} />;
             case 6: // Features step
                return <Step7Features
                            data={characterData}
                            updateData={updateCharacterData}
                            setValidity={setValidityCallback}
                            allFeatures={allFeatures} // Pass all derived features
                            isLoadingFeatures={isFetchingFeatures}
                            combinedContent={combinedContent}
                        />;
            case 7: // Equipment Step
                 if (!editMode) {
                    return <Step6Equipment data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} combinedContent={combinedContent} />;
                 }
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
