import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { Character } from '@/lib/types';
import { calculateAbilityModifier } from '@/services/rules-service'; // Import calculation function
import { useState, useEffect, useMemo } from 'react'; // Import hooks

interface CharacterStatsProps {
    stats: Character['stats'];
    baseStats: Character['stats']; // Base stats before modifications
}

interface StatDisplayData {
    name: keyof Character['stats'];
    baseValue: number;
    finalValue: number;
    modifier: number;
}

export function CharacterStats({ stats, baseStats }: CharacterStatsProps) {
    const [displayData, setDisplayData] = useState<StatDisplayData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Memoize stats to prevent unnecessary recalculations if props don't change
    const memoizedStats = useMemo(() => stats, [stats]);
    const memoizedBaseStats = useMemo(() => baseStats, [baseStats]);

    useEffect(() => {
        const calculateModifiers = async () => {
            setIsLoading(true);
            const dataPromises = (Object.keys(memoizedStats) as Array<keyof typeof memoizedStats>).map(async (name) => {
                const finalValue = memoizedStats[name];
                const baseValue = memoizedBaseStats[name];
                const modifier = await calculateAbilityModifier(finalValue); // Calculate modifier asynchronously
                return { name, baseValue, finalValue, modifier };
            });
            const resolvedData = await Promise.all(dataPromises);
            setDisplayData(resolvedData);
            setIsLoading(false);
        };

        calculateModifiers();
    }, [memoizedStats, memoizedBaseStats]); // Recalculate when memoized stats change

    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Ability Scores</CardTitle>
                <CardDescription>Score (Modifier)</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isLoading ? (
                     <p>Loading stats...</p> // Or skeleton loaders
                ) : (
                    displayData.map(({ name, baseValue, finalValue, modifier }) => {
                        const modifierString = modifier >= 0 ? `+${modifier}` : `${modifier}`;
                        return (
                            <div key={name} className="text-center p-3 border rounded-md bg-secondary/30 relative pt-6">
                                <Label className="uppercase text-xs font-semibold tracking-wider text-muted-foreground absolute top-1 left-1/2 transform -translate-x-1/2 capitalize">{name}</Label>
                                <div className="relative mt-1">
                                    <div className="text-4xl font-bold text-center h-auto p-0 border-none bg-transparent">
                                        {finalValue}
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
                    })
                )}
            </CardContent>
        </Card>
    );
}
