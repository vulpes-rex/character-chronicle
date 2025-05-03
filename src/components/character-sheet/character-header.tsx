import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Edit, BedDouble, BedSingle, Loader2 } from 'lucide-react';
import type { Character } from '@/lib/types';

interface CharacterHeaderProps {
    character: Character;
    onShortRest: () => void;
    onLongRest: () => void;
    isSaving: boolean;
}

export function CharacterHeader({ character, onShortRest, onLongRest, isSaving }: CharacterHeaderProps) {
    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-2xl font-bold">{character.characterName}</h1>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        <span>Class: {character.class}</span>
                        <span>Race: {character.race}</span>
                        <span>Level: {character.level}</span>
                        <span>Background: {character.background}</span>
                        <span>Player: {character.playerName}</span>
                        <span>Alignment: {character.alignment}</span>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/character/edit/${character.id}`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Character
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={onShortRest} disabled={isSaving}>
                        <BedSingle className="mr-2 h-4 w-4" /> Short Rest
                    </Button>
                    <Button variant="default" size="sm" onClick={onLongRest} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <BedDouble className="mr-2 h-4 w-4" /> Long Rest
                    </Button>
                </div>
            </CardHeader>
        </Card>
    );
}
