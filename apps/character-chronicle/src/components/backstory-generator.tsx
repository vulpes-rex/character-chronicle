'use client';

import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea'; // Use alias
import { ScrollArea } from '@/components/ui/scroll-area'; // Use alias
import { useToast } from '@/hooks/use-toast'; // Use alias
import { generateCharacterBackstory } from '@/ai/flows/generate-character-backstory'; // AI flow import remains
import type { GenerateCharacterBackstoryInput, GenerateCharacterBackstoryOutput } from '@/ai/flows/generate-character-backstory'; // Use alias
import { ScrollText, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert'; // Use alias (relative)
import { AlertCircle } from 'lucide-react';
import type { Character } from '@/lib/types'; // Import Character type
import { loadCharacterAction } from '@/app/actions/character-actions'; // Use Server Action
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Keep for managing state/cache if desired, or remove if direct action calls are sufficient


// Props to accept character details
interface BackstoryGeneratorProps {
    characterId?: string; // Optional: To fetch data or update the character
    // Props below are less likely to be passed now if relying on fetch
    characterRace?: string;
    characterClass?: string;
    characterAlignment?: string;
}

export function BackstoryGenerator({ characterId, characterRace, characterClass, characterAlignment }: BackstoryGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatedBackstory, setGeneratedBackstory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [characterData, setCharacterData] = useState<Character | null>(null);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient(); // Keep if using query cache

  // Fetch character data when dialog opens if ID is provided and props are missing
  useEffect(() => {
      const fetchCharacter = async () => {
          if (characterId && isOpen && (!characterRace || !characterClass || !characterAlignment)) {
              setIsLoadingCharacter(true);
              const result = await loadCharacterAction(characterId);
              if (result.success && result.character) {
                  setCharacterData(result.character);
              } else {
                  toast({ variant: 'destructive', title: 'Error', description: `Failed to load character details: ${result.error}` });
                  setCharacterData(null); // Reset data on failure
              }
              setIsLoadingCharacter(false);
          } else if (!characterId && isOpen) {
              // Handle case where no character ID is available when opened
               toast({ variant: 'default', title: 'Info', description: 'Select a character or view their sheet to generate a backstory.' });
          }
      };

      fetchCharacter();
  }, [characterId, isOpen, characterRace, characterClass, characterAlignment, toast]);

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

  // TODO: Implement applying backstory using updateCharacterAction
  const handleApplyBackstory = async () => {
    if (!characterId || !generatedBackstory) return;
     // Optimistic UI update could happen here if needed
    try {
        // Call server action to update character
        // const updateResult = await updateCharacterAction(characterId, { backstory: generatedBackstory }, /* need user ID */);
        // if (!updateResult.success) throw new Error(updateResult.error);

        toast({ title: "Backstory Applied", description: "Character sheet updated (simulation)." });
         // Optionally invalidate character query to refetch if using react-query
         // queryClient.invalidateQueries({ queryKey: ['character', characterId] });
         setIsOpen(false); // Close dialog on apply
    } catch (error) {
         toast({ variant: "destructive", title: "Apply Failed", description: `Could not save backstory. ${error instanceof Error ? error.message : ''}` });
    }
  };

  const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) {
           // Reset state when closing
           setGeneratedBackstory(null);
           setCharacterData(null);
           setIsLoadingCharacter(false);
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
                     : 'Select a character or ensure Race, Class, and Alignment are set on the sheet.'
                  }
              </DialogDescription>
           )}
        </DialogHeader>

         {!canGenerate && !isLoadingCharacter && characterId && (
              <Alert variant="default" className="my-4">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Missing Information</AlertTitle>
                 <AlertDescription>
                    Could not load character details (Race, Class, Alignment) for the selected character, or they are not set. Please ensure they are set on the character sheet.
                 </AlertDescription>
              </Alert>
         )}
        {!characterId && !isLoadingCharacter && (
             <Alert variant="default" className="my-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Character Selected</AlertTitle>
                <AlertDescription>
                   Please view a character sheet to generate a backstory.
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
              {characterId && generatedBackstory && <Button onClick={handleApplyBackstory} variant="default" disabled={!characterId /* Add user ID check if needed */}>Apply to Sheet</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    