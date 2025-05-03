import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { Character } from '@/lib/types';

interface CharacterStatsProps {
    stats: Character['stats'];
    baseStats: Character['stats']; // Base stats before modifications
    modifiers: Record<keyof Character['stats'], number>;
}

export function CharacterStats({ stats, baseStats, modifiers }: CharacterStatsProps) {
    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Ability Scores</CardTitle>
                <CardDescription>Score (Modifier)</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.keys(stats) as Array<keyof typeof stats>).map((name) => {
                    const derivedValue = stats[name];
                    const baseValue = baseStats[name];
                    const modifierValue = modifiers[name];
                    const modifierString = modifierValue >= 0 ? `+${modifierValue}` : `${modifierValue}`;
                    return (
                        <div key={name} className="text-center p-3 border rounded-md bg-secondary/30 relative pt-6">
                            <Label className="uppercase text-xs font-semibold tracking-wider text-muted-foreground absolute top-1 left-1/2 transform -translate-x-1/2 capitalize">{name}</Label>
                            <div className="relative mt-1">
                                <div className="text-4xl font-bold text-center h-auto p-0 border-none bg-transparent">
                                    {derivedValue}
                                </div>
                                <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 border border-primary bg-background rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold text-primary shadow-md">
                                    {modifierString}
                                </div>
                            </div>
                            <div className="text-[0.6rem] text-muted-foreground h-3 mt-1">
                                (Base: {baseValue})
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
