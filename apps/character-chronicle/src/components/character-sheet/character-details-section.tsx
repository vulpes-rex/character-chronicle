import React from 'react';
import type { Character } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CharacterDetailsSectionProps {
    appearance: string;
    backstory: string;
    onAppearanceChange?: (value: string) => void; // Optional: For editable fields
    onBackstoryChange?: (value: string) => void; // Optional: For editable fields
    isEditable?: boolean; // Flag to enable/disable editing
}

export function CharacterDetailsSection({
    appearance,
    backstory,
    onAppearanceChange,
    onBackstoryChange,
    isEditable = false,
}: CharacterDetailsSectionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Details & Backstory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="appearance" className="text-sm font-semibold">Appearance</Label>
                    {isEditable && onAppearanceChange ? (
                        <Textarea
                            id="appearance"
                            value={appearance}
                            onChange={(e) => onAppearanceChange(e.target.value)}
                            placeholder="Describe your character's appearance..."
                            rows={4}
                            className="mt-1 text-sm"
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{appearance || 'No description provided.'}</p>
                    )}
                </div>
                <div>
                    <Label htmlFor="backstory" className="text-sm font-semibold">Backstory</Label>
                     {isEditable && onBackstoryChange ? (
                        <Textarea
                            id="backstory"
                            value={backstory}
                            onChange={(e) => onBackstoryChange(e.target.value)}
                            placeholder="Detail your character's history..."
                            rows={8}
                            className="mt-1 text-sm"
                        />
                     ) : (
                         <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{backstory || 'No backstory provided.'}</p>
                     )}
                </div>
                {/* Consider adding sections for Personality Traits, Ideals, Bonds, Flaws if needed */}
            </CardContent>
        </Card>
    );
}
