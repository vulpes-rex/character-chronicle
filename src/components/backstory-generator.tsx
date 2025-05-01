'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { generateCharacterBackstory } from '@/ai/flows/generate-character-backstory';
import type { GenerateCharacterBackstoryInput, GenerateCharacterBackstoryOutput } from '@/ai/flows/generate-character-backstory';
import { ScrollText, Loader2 } from 'lucide-react'; // Using ScrollText for backstory icon

const formSchema = z.object({
  race: z.string().min(1, { message: 'Race is required.' }),
  class: z.string().min(1, { message: 'Class is required.' }),
  alignment: z.string().min(1, { message: 'Alignment is required.' }),
});

export function BackstoryGenerator() {
  const [isOpen, setIsOpen] = useState(false);
  const [generatedBackstory, setGeneratedBackstory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // TODO: Get default values from character state if available
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      race: '',
      class: '',
      alignment: '',
    },
  });

   async function onSubmit(values: z.infer<typeof formSchema>) {
      setIsLoading(true);
      setGeneratedBackstory(null);
      try {
          const input: GenerateCharacterBackstoryInput = {
              race: values.race,
              class: values.class, // Ensure field name matches schema ('class')
              alignment: values.alignment,
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

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            // Optionally reset form or generated backstory when closing
             form.reset();
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
            Enter your character's details to generate a unique backstory using AI.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField
                   control={form.control}
                   name="race"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Race</FormLabel>
                       <FormControl>
                         <Input placeholder="e.g., High Elf" {...field} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
                 <FormField
                   control={form.control}
                   name="class"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Class</FormLabel>
                       <FormControl>
                         <Input placeholder="e.g., Paladin" {...field} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
                 <FormField
                   control={form.control}
                   name="alignment"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Alignment</FormLabel>
                       <FormControl>
                         <Input placeholder="e.g., Chaotic Good" {...field} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
             </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate Backstory
            </Button>
          </form>
        </Form>

        {generatedBackstory && (
          <div className="mt-6 space-y-2">
            <h4 className="font-semibold">Generated Backstory:</h4>
            <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-secondary/30">
              <p className="text-sm whitespace-pre-wrap">{generatedBackstory}</p>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="mt-4">
            <DialogClose asChild>
                <Button variant="outline">Close</Button>
             </DialogClose>
             {/* TODO: Add button to copy or apply backstory */}
             {generatedBackstory && <Button onClick={() => navigator.clipboard.writeText(generatedBackstory)}>Copy Backstory</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
