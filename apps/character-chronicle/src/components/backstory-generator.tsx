'use client';

import { useState } from 'react';
// Removed useForm imports as we get data via props now
import { Button } from '@/components/ui/button'; // Use alias
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog'; // Use alias
// Removed Form imports
import { Textarea } from '@/components/ui/textarea'; // Use alias
import { ScrollArea } from '@/components/ui/scroll-area'; // Use alias
import { useToast } from '@/hooks/use-toast'; // Use alias
import { generateCharacterBackstory } from '@/ai/flows/generate-character-backstory'; // Use alias
import type { GenerateCharacterBackstoryInput, GenerateCharacterBackstoryOutput } from '@/ai/flows/generate-character-backstory'; // Use alias
import { ScrollText, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert'; // Use alias (relative)
import { AlertCircle } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query'; // To access character data from cache
import type { Character } from '@/lib/types'; // Use alias
import { loadCharacter } from '@/services/character-service'; // Use alias


// Props to accept character details - these might be undefined if not passed directly
interface BackstoryGeneratorProps {
    characterId?: string; // Optional: To potentially update the character directly or fetch data
    // Props below might not be provided by AppLayout anymore
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

   // Attempt to fetch character data if ID is present and details are missing
   const { data: characterData, isLoading: isLoadingCharacter } = useQuery<Character | null, Error>({
      queryKey: ['character', characterId],
      queryFn: () => characterId ? loadCharacter(characterId) : Promise.resolve(null), // Ensure loadCharacter is client-compatible or wrapped if used client-side
      enabled: !!characterId && isOpen && (!characterRace || !characterClass || !characterAlignment), // Only fetch if ID exists, dialog is open, and props are missing
      staleTime: 5 * 60 * 1000, // Cache for 5 mins
  });

   // Determine if we have enough data to generate, prioritize props, fallback to fetched data
  const race = characterRace ?? characterData?.race;
  const cls = characterClass ?? characterData?.class; // Use 'cls' as variable name
  const alignment = characterAlignment ?? characterData?.alignment;
  const canGenerate = !!race && !!cls && !!alignment;


    async function handleGenerate() {
        if (!canGenerate) {
             toast({ variant: "destructive", title: "Missing Information", description: "Character race, class, and alignment must be set." });
             return;
        }

        setIsLoading(true);
        setGeneratedBackstory(null);
        try {
            const input: GenerateCharacterBackstoryInput = {
                race: race!, // Non-null assertion because we checked canGenerate
                class: cls!,
                alignment: alignment!,
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
           queryClient.invalidateQueries({ queryKey: ['character', characterId] }); // Invalidate after successful apply
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

    // Disable button if characterId exists but no race/class/alignment are found (still loading or invalid character)
    const triggerDisabled = !!characterId && !isLoadingCharacter && !canGenerate;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
       <DialogTrigger asChild>
           <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                disabled={triggerDisabled} // Disable trigger if character selected but no data yet
                title={triggerDisabled ? "Character details (race, class, alignment) needed" : "Generate Backstory"}
           >
             <ScrollText />
             <span className="group-data-[collapsible=icon]:hidden">Generate Backstory</span>
           </Button>
       </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Character Backstory Generator</DialogTitle>
           {isLoadingCharacter ? (
                <DialogDescription>Loading character details...</DialogDescription>
           ) : (
              <DialogDescription>
                 {canGenerate
                     ? `Generating backstory for a ${race} ${cls} (${alignment}).`
                     : 'Select a character with Race, Class, and Alignment set, or view their sheet.'
                  }
              </DialogDescription>
           )}
        </DialogHeader>

         {!canGenerate && !isLoadingCharacter && (
              <Alert variant="default" className="my-4">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Missing Information</AlertTitle>
                 <AlertDescription>
                    {characterId
                        ? 'Could not load character details (Race, Class, Alignment) for the selected character. Ensure they are set on the character sheet.'
                        : 'No character selected or character details missing. Please view a character with Race, Class, and Alignment set.'
                    }
                 </AlertDescription>
              </Alert>
         )}

         <div className="flex justify-center mt-4 mb-2">
            <Button onClick={handleGenerate} disabled={isLoading || isLoadingCharacter || !canGenerate} className="w-1/2">
              {(isLoading || isLoadingCharacter) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
              {/* Apply button logic remains the same */}
              {characterId && generatedBackstory && <Button onClick={handleApplyBackstory} variant="default">Apply to Sheet</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
