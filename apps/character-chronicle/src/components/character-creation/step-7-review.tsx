'use client';

import React from 'react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Step7ReviewProps {
    characterData: PartialCharacterFormData;
}

export function Step7Review({ characterData }: Step7ReviewProps) {
    const {
        playerName,
        characterName,
        race,
        class: characterClass, // Rename for clarity
        level,
        background,
        alignment,
        stats,
        skills,
        proficiencies,
        features,
        equipment,
        spellsKnown, // Added spells
        spellsPrepared, // Added spells
        backstory,
        appearance,
    } = characterData;

    const getModifier = (score?: number | null) => {
        if (score === null || score === undefined) return '+0';
        const mod = Math.floor((score - 10) / 2);
        return mod >= 0 ? `+${mod}` : `${mod}`;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Review Your Character</CardTitle>
                <CardDescription>Review all the details before saving your character.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-6 text-sm">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><span className="font-semibold">Player Name:</span> {playerName || 'N/A'}</div>
                            <div><span className="font-semibold">Character Name:</span> {characterName || 'N/A'}</div>
                            <div><span className="font-semibold">Race:</span> {race || 'N/A'}</div>
                            <div><span className="font-semibold">Class:</span> {characterClass || 'N/A'}</div>
                            <div><span className="font-semibold">Level:</span> {level || 1}</div>
                            <div><span className="font-semibold">Background:</span> {background || 'N/A'}</div>
                            <div><span className="font-semibold">Alignment:</span> {alignment || 'N/A'}</div>
                        </div>

                        <Separator />

                        {/* Ability Scores */}
                        <div>
                            <h4 className="font-semibold mb-2">Ability Scores</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {stats && Object.entries(stats).map(([stat, score]) => (
                                    <div key={stat} className="text-center border rounded p-2">
                                        <div className="text-xs uppercase text-muted-foreground">{stat.substring(0, 3)}</div>
                                        <div className="font-bold text-lg">{score ?? '-'}</div>
                                        <div className="text-xs">{getModifier(score)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* Proficiencies & Skills */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold mb-2">Proficiencies</h4>
                                <ul className="space-y-1 list-disc pl-5 text-xs">
                                    {proficiencies?.armor?.length > 0 && <li>Armor: {proficiencies.armor.join(', ')}</li>}
                                    {proficiencies?.weapons?.length > 0 && <li>Weapons: {proficiencies.weapons.join(', ')}</li>}
                                    {proficiencies?.tools?.length > 0 && <li>Tools: {proficiencies.tools.join(', ')}</li>}
                                    {proficiencies?.savingThrows?.length > 0 && <li>Saving Throws: {proficiencies.savingThrows.join(', ')}</li>}
                                    {proficiencies?.languages?.length > 0 && <li>Languages: {proficiencies.languages.join(', ')}</li>}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Skills</h4>
                                <ul className="space-y-1 text-xs">
                                    {skills && Object.entries(skills)
                                        .filter(([_, proficient]) => proficient)
                                        .map(([skill]) => (
                                            <li key={skill} className="capitalize">{skill}</li>
                                        ))}
                                </ul>
                            </div>
                        </div>

                        <Separator />

                        {/* Features */}
                        {features && features.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-2">Features & Traits</h4>
                                <ul className="space-y-1 list-disc pl-5 text-xs">
                                    {features.map(feature => (
                                        <li key={feature.name}>{feature.name} ({feature.source})</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                         {/* Spells */}
                        {(spellsKnown && spellsKnown.length > 0) || (spellsPrepared && spellsPrepared.length > 0) ? (
                            <>
                                <Separator />
                                <div>
                                    <h4 className="font-semibold mb-2">Spells</h4>
                                     {spellsPrepared ? (
                                        <p className="text-xs mb-1">Prepared: {spellsPrepared.join(', ') || 'None'}</p>
                                     ) : spellsKnown ? (
                                         <p className="text-xs mb-1">Known: {spellsKnown.join(', ') || 'None'}</p>
                                     ) : null}
                                </div>
                             </>
                         ) : null}


                        <Separator />

                        {/* Equipment */}
                        {equipment && equipment.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-2">Equipment</h4>
                                <ul className="space-y-1 list-disc pl-5 text-xs">
                                    {equipment.map((item, index) => (
                                        <li key={`${item.name}-${index}`}>
                                            {item.name} {item.quantity && item.quantity > 1 ? `(x${item.quantity})` : ''}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <Separator />

                        {/* Appearance & Backstory */}
                        <div>
                            <h4 className="font-semibold mb-2">Appearance</h4>
                            <p className="text-xs whitespace-pre-wrap text-muted-foreground">{appearance || 'N/A'}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Backstory</h4>
                            <p className="text-xs whitespace-pre-wrap text-muted-foreground">{backstory || 'N/A'}</p>
                        </div>

                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
