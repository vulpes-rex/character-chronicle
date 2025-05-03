import React from 'react';
import type { Character } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CharacterSheetHeaderProps {
    characterName: string;
    playerName: string;
    level: number;
    race: string;
    characterClass: string; // Assuming single class for header display
    alignment?: string;
    background?: string;
    // imageUrl?: string; // Optional image URL
}

export function CharacterSheetHeader({
    characterName,
    playerName,
    level,
    race,
    characterClass,
    alignment,
    background,
}: CharacterSheetHeaderProps) {

     const getInitials = (name?: string | null): string => {
        if (!name) return '?';
        const names = name.split(' ');
        if (names.length === 1) return names[0].charAt(0).toUpperCase();
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    };


    return (
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-4">
            {/* Basic Avatar Placeholder */}
            <Avatar className="h-16 w-16 border">
                {/* <AvatarImage src={imageUrl} alt={characterName} /> */}
                <AvatarFallback className="text-xl">{getInitials(characterName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <CardTitle className="text-3xl font-bold mb-1">{characterName}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                    <span>Player: {playerName || 'N/A'}</span>
                    <span>Level: {level || 1}</span>
                    <span>Race: {race || 'N/A'}</span>
                    <span>Class: {characterClass || 'N/A'}</span>
                    <span>Alignment: {alignment || 'N/A'}</span>
                    <span>Background: {background || 'N/A'}</span>
                </CardDescription>
            </div>
        </CardHeader>
    );
}
