
'use client';

import { useState } from 'react';
// Removed useForm imports as we get data via props now
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
// Removed Form imports
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { generateCharacterBackstory } from '@/ai/flows/generate-character-backstory';
import type { GenerateCharacterBackstoryInput, GenerateCharacterBackstoryOutput } from '@/ai/flows/generate-character-backstory';
import { ScrollText, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query'; // To potentially access character data from cache
import type { Character } from '@/lib/types'; // Import Character type


// Props to accept character details
interface BackstoryGeneratorProps {
    characterId?: string; // Optional: To potentially update the character directly
    characterRace?: string;
    characterClass?: string;
    characterAlignment?: string;
}

export function BackstoryGenerator({ characterId, characterRace, characterClass, characterAlignment }: BackstoryGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatedBackstory, setGeneratedBackstory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determine if we have enough data to generate
  const canGenerate = !!characterRace && !!characterClass && !!characterAlignment;

  // Attempt to get character data from cache if props are missing
  // This part is experimental and depends on how character data is keyed in React Query
  // const cachedCharacter = characterId ? queryClient.getQueryData<Character>(['character', characterId]) : undefined;
  // const race = characterRace ?? cachedCharacter?.race;
  // const cls = characterClass ?? cachedCharacter?.class; // Use 'cls' as variable name
  // const alignment = characterAlignment ?? cachedCharacter?.alignment;
  // const canGenerate = !!race && !!cls && !!alignment;


    async function handleGenerate() {
        if (!canGenerate) {
             toast({ variant: "destructive", title: "Missing Information", description: "Character race, class, and alignment must be set." });
             return;
        }

        setIsLoading(true);
        setGeneratedBackstory(null);
        try {
            const input: GenerateCharacterBackstoryInput = {
                race: characterRace!, // Non-null assertion because we checked canGenerate
                class: characterClass!,
                alignment: characterAlignment!,
            };
            const result: GenerateCharacterBackstoryOutput = await generateCharacterBackstory(input);
            setGeneratedBackstory(result.backstory);
            toast({
                title: "Backstory Generated",
                description: "Your character's backstory is ready!",
            });
        } catch (error) {
            console.error("Error generating backstory:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: `Failed to generate backstory. ${error instanceof Error ? error.message : 'Please try again.'}`,
            });
        } finally {
            setIsLoading(false);
        }
    }

    // TODO: Implement applying backstory to character sheet state/database
    const handleApplyBackstory = async () => {
      if (!characterId || !generatedBackstory) return;
       // Optimistic UI update could happen here if needed
      try {
          // Call service to update character
          // await updateCharacter(characterId, { backstory: generatedBackstory });
          toast({ title: "Backstory Applied", description: "Character sheet updated (simulation)." });
           // Optionally invalidate character query to refetch
           // queryClient.invalidateQueries({ queryKey: ['character', characterId] });
           setIsOpen(false); // Close dialog on apply
      } catch (error) {
           toast({ variant: "destructive", title: "Apply Failed", description: "Could not save backstory." });
      }
    };


    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
             // Reset generated backstory when closing
             setGeneratedBackstory(null);
        }
    };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
       <DialogTrigger asChild>
           <Button variant="ghost" className="w-full justify-start gap-2">
             <ScrollText />
             <span className="group-data-[collapsible=icon]:hidden">Generate Backstory</span>
           </Button>
       </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Character Backstory Generator</DialogTitle>
          <DialogDescription>
             {canGenerate
                 ? `Generating backstory for a ${characterRace} ${characterClass} (${characterAlignment}).`
                 : 'Character details (race, class, alignment) needed.'
              }
          </DialogDescription>
        </DialogHeader>

         {!canGenerate && (
              <Alert variant="default" className="my-4">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Missing Information</AlertTitle>
                 <AlertDescription>
                    Please ensure the character has a Race, Class, and Alignment selected on their sheet before generating a backstory.
                 </AlertDescription>
              </Alert>
         )}

         <div className="flex justify-center mt-4 mb-2">
            <Button onClick={handleGenerate} disabled={isLoading || !canGenerate} className="w-1/2">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate Backstory
            </Button>
        </div>


        {generatedBackstory && (
          <div className="mt-6 space-y-2">
            <h4 className="font-semibold">Generated Backstory:</h4>
            <ScrollArea className="h-[250px] w-full rounded-md border p-4 bg-secondary/30">
              <p className="text-sm whitespace-pre-wrap">{generatedBackstory}</p>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="mt-4">
            <DialogClose asChild>
                <Button variant="outline">Close</Button>
             </DialogClose>
              {generatedBackstory && <Button onClick={() => navigator.clipboard.writeText(generatedBackstory)}>Copy Backstory</Button>}
              {/* TODO: Enable apply button when functionality is ready */}
             {/* {characterId && generatedBackstory && <Button onClick={handleApplyBackstory} variant="default">Apply to Sheet (WIP)</Button>} */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
