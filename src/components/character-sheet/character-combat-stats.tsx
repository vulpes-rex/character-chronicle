import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HeartPulse } from 'lucide-react';
import type { HitPointsState, HitDiceState } from '@/lib/types';
import { calculateAbilityModifier } from '@/services/rules-service'; // Import
import { useState, useEffect } from 'react'; // Import hooks

interface CharacterCombatStatsProps {
    dexterityScore: number; // Pass score instead of pre-calculated initiative
    armorClass: number;
    speed: string;
    hitPoints: HitPointsState;
    hitDice: HitDiceState;
    onHpChange: (type: 'current' | 'temporary', value: string) => void;
    isSaving: boolean;
}

export function CharacterCombatStats({
    dexterityScore, // Updated prop
    armorClass,
    speed,
    hitPoints,
    hitDice,
    onHpChange,
    isSaving,
}: CharacterCombatStatsProps) {
    const [initiative, setInitiative] = useState<number | string>('...'); // State for initiative

    useEffect(() => {
        const calculateInitiative = async () => {
            const dexMod = await calculateAbilityModifier(dexterityScore);
            setInitiative(dexMod);
        };
        calculateInitiative();
    }, [dexterityScore]);

    const initiativeString = typeof initiative === 'number'
        ? (initiative >= 0 ? `+${initiative}` : `${initiative}`)
        : initiative; // Show '...' while loading

    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Combat Stats</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-center">
                <div className="border rounded-md p-3 bg-secondary/30">
                    <Label className="text-xs uppercase text-muted-foreground">Armor Class</Label>
                    <div className="text-3xl font-bold mt-1">{armorClass}</div>
                </div>
                <div className="border rounded-md p-3 bg-secondary/30">
                    <Label className="text-xs uppercase text-muted-foreground">Initiative</Label>
                    <div className="text-3xl font-bold mt-1">{initiativeString}</div>
                </div>
                <div className="border rounded-md p-3 bg-secondary/30">
                    <Label className="text-xs uppercase text-muted-foreground">Speed</Label>
                    <div className="text-3xl font-bold mt-1">{speed}</div>
                </div>
                <div className="col-span-3 border rounded-md p-3 bg-secondary/30">
                    <Label className="text-xs uppercase text-muted-foreground flex items-center justify-center gap-1"><HeartPulse className='inline h-3 w-3' /> Hit Points</Label>
                    <div className="flex justify-center items-center gap-2 mt-1">
                        <Input
                            type="number"
                            value={hitPoints.current}
                            onChange={(e) => onHpChange('current', e.target.value)}
                            className="w-20 text-center text-lg font-semibold"
                            aria-label="Current Hit Points"
                            max={hitPoints.max}
                            min={0}
                            disabled={isSaving}
                        />
                        <span className="text-muted-foreground">/</span>
                        <span className="w-20 text-center text-lg font-semibold">{hitPoints.max}</span>
                    </div>
                    {hitPoints.temporary > 0 && (
                        <div className='flex items-center justify-center gap-2 mt-1'>
                            <Label htmlFor='temp-hp' className='text-xs text-blue-400'>Temp HP:</Label>
                            <Input
                                id='temp-hp'
                                type="number"
                                value={hitPoints.temporary}
                                onChange={(e) => onHpChange('temporary', e.target.value)}
                                className="w-16 h-6 text-center text-xs font-semibold"
                                aria-label="Temporary Hit Points"
                                min={0}
                                disabled={isSaving}
                            />
                        </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-border/50">
                        <Label className="text-xs uppercase text-muted-foreground">Hit Dice</Label>
                        <p className='text-sm font-medium'>{hitDice.remaining} / {hitDice.total} ({hitDice.dieType || 'N/A'})</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
