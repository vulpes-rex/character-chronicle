import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckSquare, Square } from 'lucide-react';
import { ALL_SKILLS, SKILL_ABILITY_MAP, Character } from '@/lib/types';
import { calculateSkillModifier } from '@/services/dnd-api'; // Use centralized calculation

interface CharacterSkillsProps {
    character: Character;
    proficiencyBonus: number;
    onRoll: (diceString: string, label: string) => Promise<number>;
}

export function CharacterSkills({ character, proficiencyBonus, onRoll }: CharacterSkillsProps) {
    const skillModifiers = Object.entries(character.stats).reduce((acc, [stat, value]) => {
         return { ...acc, [stat]: Math.floor((value - 10) / 2) };
    }, {} as Record<keyof Character['stats'], number>);

    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Skills</CardTitle>
                <CardDescription>Proficiency Bonus: +{proficiencyBonus}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
                {ALL_SKILLS.map((skill) => {
                    const proficient = !!character.skills[skill];
                    const modifier = calculateSkillModifier(skill, character.stats, proficient, proficiencyBonus);
                    const ability = SKILL_ABILITY_MAP[skill];
                    const modifierString = modifier >= 0 ? `+${modifier}` : `${modifier}`;

                    return (
                        <div key={skill} className="flex items-center justify-between p-1 rounded hover:bg-secondary/50 group">
                            <div className="flex items-center gap-2">
                                {proficient ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted" />}
                                <Label className="capitalize text-sm font-normal flex-grow w-[100px] truncate" title={skill}>
                                    {skill}
                                    <span className='text-xs text-muted-foreground ml-1'>({ability.substring(0, 3)})</span>
                                </Label>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-sm font-medium text-primary hover:bg-primary/10"
                                onClick={() => onRoll(`1d20+${modifier}`, `${skill.charAt(0).toUpperCase() + skill.slice(1)} Check`)}
                                title={`Roll ${skill} check (1d20 ${modifierString})`}
                            >
                                {modifierString}
                            </Button>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
