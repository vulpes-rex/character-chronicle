'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState } from 'react';
import type { CharacterClass, CharacterRace } from '@/services/dnd-api'; // Ensure correct path


// TODO: Fetch these from API or state management
const availableClasses: CharacterClass[] = [
    { name: 'Fighter', description: 'Master of martial combat.', hitDie: 'd10' },
    { name: 'Wizard', description: 'Scholarly magic-user.', hitDie: 'd6' },
    { name: 'Rogue', description: 'Master of stealth and subtlety.', hitDie: 'd8' },
    { name: 'Cleric', description: 'Wielder of divine magic.', hitDie: 'd8' },
];

const availableRaces: CharacterRace[] = [
    { name: 'Human', description: 'Adaptable and diverse.', traits: ['Bonus Feat', 'Skilled'] },
    { name: 'Elf', description: 'Graceful and long-lived.', traits: ['Darkvision', 'Fey Ancestry'] },
    { name: 'Dwarf', description: 'Resilient and sturdy.', traits: ['Darkvision', 'Dwarven Resilience'] },
    { name: 'Halfling', description: 'Small and lucky.', traits: ['Lucky', 'Brave'] },
];


export function CharacterSheet() {
    // Basic character info state
    const [characterName, setCharacterName] = useState('');
    const [characterClass, setCharacterClass] = useState<CharacterClass | null>(null);
    const [characterRace, setCharacterRace] = useState<CharacterRace | null>(null);
    const [level, setLevel] = useState(1);
    const [alignment, setAlignment] = useState('');
    const [background, setBackground] = useState('');
    const [playerName, setPlayerName] = useState('');

    // Stats state (using 5e standard array for defaults)
    const [stats, setStats] = useState({
        strength: 15,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 8,
    });

    // Skills state (simplified - just proficiency toggle)
    const [skills, setSkills] = useState({
        acrobatics: false, athletics: false, arcana: false, deception: false, history: false,
        insight: false, intimidation: false, investigation: false, medicine: false, nature: false,
        perception: false, performance: false, persuasion: false, religion: false,
        sleightOfHand: false, stealth: false, survival: false,
    });

    // Equipment state
    const [equipment, setEquipment] = useState('');
    const [backstory, setBackstory] = useState(''); // Added for backstory

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
                        {/* Dropdowns would be better here, using text inputs for simplicity */}
                         <Input placeholder="Class" value={characterClass?.name ?? ''} onChange={(e) => {/* TODO: Handle class selection */}} />
                         <Input placeholder="Race" value={characterRace?.name ?? ''} onChange={(e) => {/* TODO: Handle race selection */}}/>
                         <Input placeholder="Level" type="number" value={level} onChange={(e) => setLevel(parseInt(e.target.value) || 1)}/>
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
                  <div key={name} className="text-center p-3 border rounded-md bg-secondary/30">
                    <Label htmlFor={name} className="uppercase text-xs font-semibold tracking-wider text-muted-foreground">{name}</Label>
                     <div className="relative mt-1">
                        <Input
                            id={name}
                            type="number"
                            value={value}
                            onChange={(e) => handleStatChange(name as keyof typeof stats, e.target.value)}
                            className="text-4xl font-bold text-center h-auto p-0 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                            aria-label={`${name} score`}
                        />
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 border border-primary bg-background rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold text-primary shadow-md">
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
                                     className="form-checkbox h-4 w-4 text-primary accent-primary focus:ring-primary rounded"
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
                {/* Placeholder for Combat Stats */}
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

                 {/* Placeholder for Features & Traits */}
                 <Card className="bg-card/80 backdrop-blur-sm">
                     <CardHeader>
                         <CardTitle>Features & Traits</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <Textarea placeholder="List your class features, racial traits, feats, etc." className="min-h-[200px]" />
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
