import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Feature } from '@/lib/types';

interface CharacterFeaturesProps {
    features: Feature[];
    uses: Record<string, number>; // Map feature name to current uses
}

export function CharacterFeatures({ features, uses }: CharacterFeaturesProps) {
    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Features & Traits</CardTitle>
            </CardHeader>
            <CardContent>
                {features.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No features or traits listed.</p>
                ) : (
                    <ScrollArea className="h-[400px]">
                        <Accordion type="multiple" className="w-full">
                            {features.map((feature, index) => (
                                <AccordionItem value={`item-${index}-${feature.name}`} key={`${index}-${feature.name}`}>
                                    <AccordionTrigger className="text-sm font-medium hover:no-underline">
                                        <span className='text-left'>{feature.name} <span className="text-xs text-muted-foreground">({feature.source})</span></span>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-sm text-muted-foreground">
                                        {feature.description}
                                        {(feature.maxUses !== null && feature.maxUses !== undefined) && (
                                            <p className="text-xs mt-1 text-primary">
                                                Uses: {uses[feature.name] ?? feature.maxUses} / {feature.maxUses} (Resets on {feature.usesResetOn || 'N/A'})
                                            </p>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
