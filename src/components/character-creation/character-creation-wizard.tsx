'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveCharacter, updateCharacter } from '@/services/character-service'; // Import updateCharacter
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, CharacterClass as CharacterClassType, SourcePack, Spell } from '@/lib/types'; // Added Spell type
import { getCharacterClasses, getCharacterRaces, getAvailableEquipmentItems, getBackgroundDetails, getSpells } from '@/services/dnd-api'; // Keep base data fetchers, Added getSpells
import { getBackgroundFeatures, getRaceFeatures, getClassFeatures, applyFeatureRules } from '@/services/feature-service'; // Import feature service and applyFeatureRules
import { calculateSkillModifier, SKILL_ABILITY_MAP, ALL_SKILLS, rollDice } from '@/lib/types';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'; // Corrected import for useQueryClient
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getCombinedContentFromPacks } from '@/services/campaign-service'; // Import function to get combined content

// Import step components
import { Step1BasicInfo } from './step-1-basic-info';
import { Step2RaceSelection } from './step-2-race-selection';
import { Step3ClassSelection } from './step-3-class-selection';
import { Step4AbilityScores } from './step-4-ability-scores';
import { Step5Background } from './step-5-background';
import { Step6Equipment } from './step-6-equipment';
import { Step7Features } from './step-7-features';
import { Step8Spells } from './step-8-spells'; // Import new spell step

export type PartialCharacterFormData = Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'hitPoints' | 'hitDice' | 'features' | 'proficiencies' | 'skills' | 'equipment' | 'spellcasting'>> & {
    stats?: Partial<Character['stats']>;
    equipment?: Partial<EquipmentItem>[];
    skills?: Partial<Record<string, boolean>>;
    selectedClasses?: { [key: string]: number };
    featureChoices?: Record<string, string | string[]>;
    activeSourcePackIds?: string[];
    spellsKnown?: string[];
    spellsPrepared?: string[];
};

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
    spellsKnown: char.spellsKnown || [],
    spellsPrepared: char.spellsPrepared || [],
    activeSourcePackIds: ['srd'], // Default or needs fetching
});


interface CharacterCreationWizardProps {
    initialData?: Character;
    editMode?: boolean;
}

export function CharacterCreationWizard({ initialData, editMode = false }: CharacterCreationWizardProps) {
    const TOTAL_STEPS = editMode ? 6 : 8; // Increased total steps for spells
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
            spellsKnown: [],
            spellsPrepared: [],
            activeSourcePackIds: ['srd'],
        }
    );
    const [isValid, setIsValid] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();
    const queryClient = useQueryClient();


    // Fetch combined content
    const { data: combinedContent, isLoading: isLoadingContent } = useQuery<SourcePack['content'], Error>({
        queryKey: ['combinedContent', characterData.activeSourcePackIds],
        queryFn: () => getCombinedContentFromPacks(characterData.activeSourcePackIds || ['srd']),
        staleTime: 5 * 60 * 1000,
        enabled: true,
    });

    // Fetch base data (classes, races, spells)
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

    // Fetch spells using combined content
     const { data: availableSpells = [], isLoading: isLoadingSpells } = useQuery<Spell[], Error>({
        queryKey: ['spells', combinedContent],
        queryFn: () => getSpells(combinedContent), // Use getSpells with combined content
        enabled: !!combinedContent,
        staleTime: Infinity, // Spells are generally static within a content set
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


    const isFetchingInitialData = isLoadingContent || isLoadingClasses || isLoadingRaces || isFetchingFeatures || isLoadingSpells;


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
             const primaryClassData = availableClasses.find(c => c.name === primaryClassKey);


              if (!characterData.race) throw new Error("Character race selection is missing.");
              if (!primaryClassKey || !primaryClassData) throw new Error("Character class selection is missing or invalid.");

            // --- Apply feature choices to the combined feature list ---
             const featuresWithChoicesApplied = allFeatures.map(feature => {
                 if (feature.metadata?.effectType === 'choiceGrant') {
                    const choiceKey = feature.metadata.choiceKey;
                    const choice = characterData.featureChoices?.[choiceKey];
                     if (choice && typeof choice === 'string' && feature.metadata.options.includes(choice)) {
                         const specificFeatureKey = `${feature.name}: ${choice}`;
                         const specificFeatureDef = allFeatures.find(f => f.name === specificFeatureKey) || combinedContent?.features?.[specificFeatureKey];

                          if (specificFeatureDef) {
                              return { ...specificFeatureDef, name: specificFeatureKey, source: feature.source };
                          } else {
                             console.warn(`Specific definition for choice "${choice}" of feature "${feature.name}" not found.`);
                             return { ...feature, description: `${feature.description} (Chosen: ${choice})`};
                          }
                     } else {
                          console.warn(`No valid choice made for feature "${feature.name}".`);
                         return null;
                     }
                 } else if (feature.metadata?.effectType === 'proficiencyGrant' && feature.metadata.choose && feature.metadata.options) {
                     const choiceKey = feature.metadata.choiceKey || feature.name;
                     const choices = characterData.featureChoices?.[choiceKey];
                     if (choices && Array.isArray(choices) && choices.length === feature.metadata.choose) {
                         return {
                             ...feature,
                             metadata: {
                                 ...feature.metadata,
                                 proficiencies: choices,
                                 choose: undefined,
                                 options: undefined,
                             }
                         };
                     } else {
                         console.warn(`Invalid or missing choices for proficiency feature "${feature.name}".`);
                         return null;
                     }
                 }
                 return feature;
             }).filter((f): f is Feature => f !== null && f.metadata?.effectType !== 'choiceGrant');


             // --- Calculate BASE Stats, HitPoints, HitDice (without derived rules applied yet) ---
             const baseStats = characterData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
             const statsAfterRacial = { ...baseStats };

            // --- Calculate derived values based on final base stats and features ---
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
                const classData = availableClasses.find(c => c.name === className);
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
             const initialProficiencies = {
                 armor: [], weapons: [], tools: [], savingThrows: [], languages: [],
             };
             const initialSkills = ALL_SKILLS.reduce((acc, skill) => { acc[skill] = false; return acc; }, {} as Record<string, boolean>);

            // --- Construct final Character object for saving ---
             const characterToSaveBase: Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>> & {id?: string} = {
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
                 equipment: (characterData.equipment as EquipmentItem[])?.map(item => ({
                    name: item.name || 'Unnamed Item', quantity: item.quantity ?? 1, description: item.description, weight: item.weight, cost: item.cost, type: item.type, isEquipped: item.isEquipped ?? false, weaponCategory: item.weaponCategory, damageDice: item.damageDice, damageType: item.damageType, properties: item.properties, armorCategory: item.armorCategory, baseAC: item.baseAC, addDexModifier: item.addDexModifier, maxDexBonus: item.maxDexBonus, strengthRequirement: item.strengthRequirement, stealthDisadvantage: item.stealthDisadvantage,
                 })) || [],
                 proficiencies: initialProficiencies,
                 features: featuresWithChoicesApplied, // Save the *final* list of features after applying choices
                 featureChoices: characterData.featureChoices || {},
                 spellsKnown: characterData.spellsKnown || [], // Save selected known spells
                 spellsPrepared: characterData.spellsPrepared || [], // Save selected prepared spells
                 backstory: characterData.backstory || '',
                 appearance: characterData.appearance || '',
                 campaignId: initialData?.campaignId,
             };

            // Apply feature rules to calculate final derived state (including spellcasting)
            const characterToSaveFinal = await applyFeatureRules(characterToSaveBase as Character); // Cast needed temporarily


            // Remove temporary or calculation-only fields before saving
            delete (characterToSaveFinal as any).selectedClasses;
            delete (characterToSaveFinal as any).activeSourcePackIds;
            // Ensure derived stats are not saved back accidentally (applyFeatureRules should return base stats)
            // characterToSaveFinal.stats = characterToSaveBase.stats!;


            if (editMode && initialData?.id) {
                await updateCharacter(initialData.id, characterToSaveFinal);
                toast({ title: 'Character Updated', description: `${characterToSaveFinal.characterName} has been successfully updated.` });
                router.push(`/character/view/${initialData.id}`);
                router.refresh();
            } else {
                delete characterToSaveFinal.id;
                const newId = await saveCharacter(characterToSaveFinal as Omit<Character, 'id' | 'createdAt' | 'updatedAt'>);
                toast({ title: 'Character Created', description: `${characterToSaveFinal.characterName} has been successfully created.` });
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

    // Determine if the current character is a spellcaster based on class
    const isSpellcaster = useMemo(() => {
        return Object.keys(characterData.selectedClasses ?? {}).some(className => {
            const classDef = availableClasses.find(c => c.name === className);
            return classDef?.spellProgression && classDef.spellProgression !== 'none';
        });
    }, [characterData.selectedClasses, availableClasses]);

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
                return <Step6Equipment data={characterData} updateData={updateCharacterData} setValidity={setValidityCallback} combinedContent={combinedContent} />;
            case 8: // Spells Step (Only if spellcaster)
                 if (!editMode && isSpellcaster) {
                    return 
                                data={characterData}
                                updateData={updateCharacterData}
                                setValidity={setValidityCallback}
                                availableSpells={availableSpells}
                                availableClasses={availableClasses} // Pass class info
                                isLoadingSpells={isLoadingSpells}
                            />;
                 }
                 // Skip spell step in edit mode or if not a spellcaster
                 setCurrentStep(prev => prev + 1); // Auto-advance if skipped
                 return Loading next step...; // Or handle finish button logic here
            default:
                // Should ideally handle final submission logic here if TOTAL_STEPS logic changes
                 if (currentStep > TOTAL_STEPS && !isLoading) {
                     // If somehow past the last step, allow submission
                     setValidityCallback(true); // Ensure final step is valid
                     return Review your choices and finish creating your character.;
                 }
                return Invalid Step or Loading...;
        }
    };

    if (isFetchingInitialData) {
        return (
          
             
             
             
             
                
                
             
          
        );
    }

     // Determine the actual final step number, considering the spell step skip
    const effectiveTotalSteps = isSpellcaster && !editMode ? TOTAL_STEPS : TOTAL_STEPS - 1;


    return (
        
            
                
            
            
                
                    
                    
                
            

            
                {renderStep()}
            

            
                
                    Previous
                
                {currentStep  effectiveTotalSteps ? (
                    
                        Next
                    
                ) : (
                    
                        {isLoading && }
                        {editMode ? 'Save Changes' : 'Finish & Create Character'}
                    
                )}
            
        
    );
}

