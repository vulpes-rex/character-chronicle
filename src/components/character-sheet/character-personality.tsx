import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface CharacterPersonalityProps {
    appearance?: string;
    backstory?: string;
}

export function CharacterPersonality({ appearance, backstory }: CharacterPersonalityProps) {
    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Personality & Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className='font-semibold mb-2'>Appearance</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[50px]">
                        {appearance || 'No description provided.'}
                    </p>
                </div>
                <Separator />
                <div>
                    <h3 className='font-semibold mb-2'>Backstory</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[150px]">
                        {backstory || 'No description provided.'}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
