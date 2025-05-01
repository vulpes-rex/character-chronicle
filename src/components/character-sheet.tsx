'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getCharacterClasses,
    getCharacterRaces,
    getCumulativeClassFeatures,
    getRaceTraitsDetails,
} from '@/services/dnd-api';
import type { CharacterClass, CharacterRace, Feature } from '@/services/dnd-api';


export function CharacterSheet() {
    // Basic character info state
    const [characterName, setCharacterName] = useState('');
    const [selectedClass, setSelectedClass] = useState<string | undefined>(undefined);
    const [selectedRace, setSelectedRace] = useState<string | undefined>(undefined);
    const [level, setLevel] = useState(1);
    const [alignment, setAlignment] = useState('');
    const [background, setBackground] = useState('');
    const [playerName, setPlayerName] = useState('');

    // Data Fetching with React Query
    const { data: availableClasses = [], isLoading: isLoadingClasses } = useQuery<CharacterClass[], Error>({
        queryKey: ['characterClasses'],
        queryFn: getCharacterClasses,
        staleTime: Infinity, // Static data
    });

    const { data: availableRaces = [], isLoading: isLoadingRaces } = useQuery<CharacterRace[], Error>({
        queryKey: ['characterRaces'],
        queryFn: getCharacterRaces,
        staleTime: Infinity, // Static data
    });

    const selectedRaceData = availableRaces.find(r => r.name === selectedRace);
    const traitNames = selectedRaceData?.traits ?? [];

    // Fetch Race Trait Details
    const { data: raceTraits = [], isLoading: isLoadingRaceTraits, error: errorRaceTraits } = useQuery<Feature[], Error>({
        queryKey: ['raceTraits', traitNames],
        queryFn: () => getRaceTraitsDetails(traitNames),
        enabled: traitNames.length > 0, // Only run query if trait names are available
        staleTime: Infinity,
    });

    // Fetch Cumulative Class Features
    const { data: classFeatures = [], isLoading: isLoadingClassFeatures, error: errorClassFeatures } = useQuery<Feature[], Error>({
        queryKey: ['classFeatures', selectedClass, level],
        queryFn: () => getCumulativeClassFeatures(selectedClass!, level),
        enabled: !!selectedClass && level > 0, // Only run query if class and level are selected
        staleTime: 5 * 60 * 1000, // Refetch class features every 5 mins or on change
    });

     // Combine features and traits
    const allFeaturesAndTraits = [...raceTraits, ...classFeatures];


    // Stats state
    const [stats, setStats] = useState({
        strength: 15,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 8,
    });

    // Skills state (simplified)
    const [skills, setSkills] = useState({
        acrobatics: false, athletics: false, arcana: false, deception: false, history: false,
        insight: false, intimidation: false, investigation: false, medicine: false, nature: false,
        perception: false, performance: false, persuasion: false, religion: false,
        sleightOfHand: false, stealth: false, survival: false,
    });

    // Equipment state
    const [equipment, setEquipment] = useState('');
    const [backstory, setBackstory] = useState('');

    const handleStatChange = (statName: keyof typeof stats, value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            setStats(prev => ({ ...prev, [statName]: numValue }));
        }
    };

    const getModifier = (statValue: number) => {
        return Math.floor((statValue - 10) / 2);
    };

    const handleSkillToggle = (skillName: keyof typeof skills) => {
        setSkills(prev => ({ ...prev, [skillName]: !prev[skillName] }));
    };


  return (
    <ScrollArea className="h-full p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <Input
                        placeholder="Character Name"
                        value={characterName}
                        onChange={(e) => setCharacterName(e.target.value)}
                        className="text-2xl font-bold max-w-xs"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        {/* Class Selection */}
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                           <SelectTrigger className="w-full" aria-label="Select Class">
                               <SelectValue placeholder={isLoadingClasses ? "Loading..." : "Class"} />
                           </SelectTrigger>
                           <SelectContent>
                               {availableClasses.map((charClass) => (
                                   <SelectItem key={charClass.name} value={charClass.name}>
                                       {charClass.name}
                                   </SelectItem>
                               ))}
                               {isLoadingClasses && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                           </SelectContent>
                       </Select>

                        {/* Race Selection */}
                        <Select value={selectedRace} onValueChange={setSelectedRace}>
                             <SelectTrigger className="w-full" aria-label="Select Race">
                                 <SelectValue placeholder={isLoadingRaces ? "Loading..." : "Race"} />
                             </SelectTrigger>
                             <SelectContent>
                                 {availableRaces.map((charRace) => (
                                     <SelectItem key={charRace.name} value={charRace.name}>
                                         {charRace.name}
                                     </SelectItem>
                                 ))}
                                 {isLoadingRaces && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                             </SelectContent>
                         </Select>

                         <Input placeholder="Level" type="number" value={level} onChange={(e) => setLevel(Math.max(1, parseInt(e.target.value) || 1))}/>
                         <Input placeholder="Background" value={background} onChange={(e) => setBackground(e.target.value)} />
                         <Input placeholder="Player Name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
                         <Input placeholder="Alignment" value={alignment} onChange={(e) => setAlignment(e.target.value)} />
                     </div>
                 </div>
            </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Stats & Skills */}
          <div className="space-y-6">
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Ability Scores</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(stats).map(([name, value]) => (
                  <div key={name} className="text-center p-3 border rounded-md bg-secondary/30 relative">
                    <Label htmlFor={name} className="uppercase text-xs font-semibold tracking-wider text-muted-foreground">{name}</Label>
                     <div className="relative mt-1">
                        <Input
                            id={name}
                            type="number"
                            value={value}
                            onChange={(e) => handleStatChange(name as keyof typeof stats, e.target.value)}
                            className="text-4xl font-bold text-center h-auto p-0 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 appearance-none m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" // Hide number spinners
                            aria-label={`${name} score`}
                        />
                        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 border border-primary bg-background rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold text-primary shadow-md">
                           {getModifier(value) >= 0 ? '+' : ''}{getModifier(value)}
                        </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

             <Card className="bg-card/80 backdrop-blur-sm">
                 <CardHeader>
                     <CardTitle>Skills</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-2">
                     {Object.entries(skills).map(([name, proficient]) => (
                         <div key={name} className="flex items-center justify-between p-2 rounded hover:bg-secondary/50">
                             <div className="flex items-center gap-2">
                                 <input
                                     type="checkbox"
                                     id={`skill-${name}`}
                                     checked={proficient}
                                     onChange={() => handleSkillToggle(name as keyof typeof skills)}
                                     className="form-checkbox h-4 w-4 text-primary accent-primary focus:ring-primary rounded cursor-pointer"
                                     aria-labelledby={`skill-label-${name}`}
                                 />
                                 <Label htmlFor={`skill-${name}`} id={`skill-label-${name}`} className="capitalize text-sm cursor-pointer">
                                     {name.replace(/([A-Z])/g, ' $1')} {/* Add space before capitals */}
                                 </Label>
                             </div>
                             {/* TODO: Calculate skill bonus based on associated stat + proficiency */}
                             <span className="text-sm font-medium text-muted-foreground">
                                +0 {/* Placeholder */}
                             </span>
                         </div>
                     ))}
                 </CardContent>
             </Card>
          </div>

           {/* Column 2: Combat & Features */}
           <div className="space-y-6">
                {/* Combat Stats */}
                <Card className="bg-card/80 backdrop-blur-sm">
                   <CardHeader>
                       <CardTitle>Combat</CardTitle>
                   </CardHeader>
                   <CardContent className="grid grid-cols-3 gap-4 text-center">
                      <div className="border rounded-md p-3 bg-secondary/30">
                           <Label className="text-xs uppercase text-muted-foreground">Armor Class</Label>
                           <div className="text-3xl font-bold mt-1">10</div> {/* Placeholder */}
                       </div>
                       <div className="border rounded-md p-3 bg-secondary/30">
                            <Label className="text-xs uppercase text-muted-foreground">Initiative</Label>
                            <div className="text-3xl font-bold mt-1">+0</div> {/* Placeholder */}
                        </div>
                        <div className="border rounded-md p-3 bg-secondary/30">
                            <Label className="text-xs uppercase text-muted-foreground">Speed</Label>
                            <div className="text-3xl font-bold mt-1">30 ft</div> {/* Placeholder */}
                        </div>
                       <div className="col-span-3 border rounded-md p-3 bg-secondary/30">
                           <Label className="text-xs uppercase text-muted-foreground">Hit Points</Label>
                           <div className="flex justify-center items-center gap-2 mt-1">
                               <Input type="number" placeholder="Current" className="w-20 text-center"/>
                                <span className="text-muted-foreground">/</span>
                               <Input type="number" placeholder="Max" className="w-20 text-center"/>
                            </div>
                        </div>
                        {/* TODO: Add Hit Dice, Death Saves */}
                    </CardContent>
                </Card>

                 {/* Features & Traits */}
                 <Card className="bg-card/80 backdrop-blur-sm">
                     <CardHeader>
                         <CardTitle>Features & Traits</CardTitle>
                     </CardHeader>
                     <CardContent>
                        {(isLoadingRaceTraits || isLoadingClassFeatures) && (
                            <div className="space-y-3">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-4 w-4/6" />
                            </div>
                        )}
                        {(errorRaceTraits || errorClassFeatures) && (
                             <Alert variant="destructive">
                                <AlertTitle>Error Loading Features</AlertTitle>
                                <AlertDescription>
                                    {errorRaceTraits?.message || errorClassFeatures?.message || 'Could not load some features.'}
                                </AlertDescription>
                            </Alert>
                        )}
                        {!isLoadingRaceTraits && !isLoadingClassFeatures && !errorRaceTraits && !errorClassFeatures && (
                            allFeaturesAndTraits.length === 0 && (!selectedClass || !selectedRace) ? (
                                <p className="text-sm text-muted-foreground">Select a race and class to see features and traits.</p>
                            ) : allFeaturesAndTraits.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No features or traits found for this level/race/class combination.</p>
                            ) : (
                                <Accordion type="multiple" className="w-full">
                                    {allFeaturesAndTraits.map((feature, index) => (
                                        <AccordionItem value={`item-${index}`} key={index}>
                                            <AccordionTrigger className="text-sm font-medium hover:no-underline">
                                                <span className='text-left'>{feature.name} <span className="text-xs text-muted-foreground">({feature.source})</span></span>
                                            </AccordionTrigger>
                                            <AccordionContent className="text-sm text-muted-foreground">
                                                {feature.description}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )
                        )}
                     </CardContent>
                 </Card>
             </div>

           {/* Column 3: Equipment & Backstory */}
           <div className="space-y-6">
             <Card className="bg-card/80 backdrop-blur-sm">
                 <CardHeader>
                     <CardTitle>Equipment</CardTitle>
                 </CardHeader>
                 <CardContent>
                     <Textarea
                        placeholder="List your weapons, armor, adventuring gear, money..."
                        value={equipment}
                        onChange={(e) => setEquipment(e.target.value)}
                        className="min-h-[150px]"
                     />
                      {/* TODO: Add currency section */}
                 </CardContent>
             </Card>

             <Card className="bg-card/80 backdrop-blur-sm">
                 <CardHeader>
                     <CardTitle>Backstory & Appearance</CardTitle>
                 </CardHeader>
                 <CardContent>
                     <Textarea
                        placeholder="Describe your character's history, personality, appearance..."
                        value={backstory}
                        onChange={(e) => setBackstory(e.target.value)}
                        className="min-h-[250px]"
                     />
                 </CardContent>
             </Card>
           </div>
        </div>
      </div>
    </ScrollArea>
  );
}
