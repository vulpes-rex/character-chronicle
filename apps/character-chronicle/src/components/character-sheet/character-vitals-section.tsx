import React from 'react';
import type { Character } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress'; // For HP bar

interface CharacterVitalsSectionProps {
    hitPoints: Character['hitPoints'];
    hitDice: Character['hitDice'];
    armorClass: number; // Pass calculated AC
    speed: number; // Pass calculated speed
    initiativeBonus: number; // Pass calculated initiative
    proficiencyBonus: number;
    passivePerception: number; // Pass calculated passive perception
    onHpChange: (newHp: number) => void; // Callback for HP changes
    onTempHpChange: (newTempHp: number) => void; // Callback for Temp HP changes
    onHitDiceChange: (newRemaining: number) => void; // Callback for HD changes
}

export function CharacterVitalsSection({
    hitPoints,
    hitDice,
    armorClass,
    speed,
    initiativeBonus,
    proficiencyBonus,
    passivePerception,
    onHpChange,
    onTempHpChange,
    onHitDiceChange,
}: CharacterVitalsSectionProps) {
    const hpPercentage = hitPoints.max > 0 ? (hitPoints.current / hitPoints.max) * 100 : 0;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle>Combat Stats & Vitals</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 text-sm">
                {/* AC */}
                <div className="flex flex-col items-center p-2 border rounded-md bg-muted/30">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Armor Class</Label>
                    <span className="text-2xl font-bold">{armorClass}</span>
                </div>
                {/* Initiative */}
                <div className="flex flex-col items-center p-2 border rounded-md bg-muted/30">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Initiative</Label>
                    <span className="text-2xl font-bold">{initiativeBonus >= 0 ? `+${initiativeBonus}` : initiativeBonus}</span>
                </div>
                {/* Speed */}
                <div className="flex flex-col items-center p-2 border rounded-md bg-muted/30">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Speed</Label>
                    <span className="text-2xl font-bold">{speed} ft</span>
                </div>
                {/* Proficiency Bonus */}
                <div className="flex flex-col items-center p-2 border rounded-md bg-muted/30">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Prof. Bonus</Label>
                    <span className="text-2xl font-bold">+{proficiencyBonus}</span>
                </div>
                {/* Passive Perception */}
                 <div className="flex flex-col items-center p-2 border rounded-md bg-muted/30">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Passive Perc.</Label>
                    <span className="text-2xl font-bold">{passivePerception}</span>
                 </div>

                 {/* Hit Points */}
                 <div className="col-span-2 sm:col-span-3 lg:col-span-4 space-y-2 mt-2 pt-2 border-t">
                     <Label htmlFor="current-hp" className="text-xs font-semibold uppercase text-muted-foreground">Hit Points</Label>
                     <div className="flex items-center gap-2">
                         <Input
                             id="current-hp"
                             type="number"
                             value={hitPoints.current}
                             onChange={(e) => onHpChange(parseInt(e.target.value) || 0)}
                             className="w-20 h-8 text-center font-semibold"
                             aria-label="Current Hit Points"
                         />
                         <span className="text-muted-foreground">/</span>
                         <span className="font-semibold">{hitPoints.max}</span>
                         <div className="flex-1 px-2">
                             <Progress value={hpPercentage} className="h-2" />
                         </div>
                     </div>
                     <div className="flex items-center gap-2">
                         <Label htmlFor="temp-hp" className="text-xs font-medium text-muted-foreground whitespace-nowrap">Temp HP:</Label>
                         <Input
                             id="temp-hp"
                             type="number"
                             value={hitPoints.temporary}
                             onChange={(e) => onTempHpChange(parseInt(e.target.value) || 0)}
                             className="w-16 h-7 text-center text-xs"
                             aria-label="Temporary Hit Points"
                         />
                     </div>
                 </div>


                 {/* Hit Dice */}
                 <div className="col-span-2 sm:col-span-1 lg:col-span-1 space-y-1 mt-2 pt-2 border-t">
                     <Label htmlFor="hit-dice" className="text-xs font-semibold uppercase text-muted-foreground">Hit Dice</Label>
                     <div className="flex items-center gap-1">
                         <Input
                             id="hit-dice-remaining"
                             type="number"
                             value={hitDice?.remaining ?? 0}
                              onChange={(e) => onHitDiceChange(parseInt(e.target.value) || 0)}
                             className="w-12 h-7 text-center text-xs"
                             aria-label="Remaining Hit Dice"
                         />
                          <span className="text-xs text-muted-foreground">/ {hitDice?.total ?? 0} ({hitDice?.dieType || 'N/A'})</span>
                     </div>
                 </div>

            </CardContent>
        </Card>
    );
}
