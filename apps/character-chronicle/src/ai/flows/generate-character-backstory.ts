'use server';

/**
 * @fileOverview Generates a character backstory based on race, class, and alignment.
 *
 * - generateCharacterBackstory - A function that handles the backstory generation.
 * - GenerateCharacterBackstoryInput - The input type for the generateCharacterBackstory function.
 * - GenerateCharacterBackstoryOutput - The return type for the generateCharacterBackstory function.
 */

import { ai } from '@/ai/ai-instance'; // Use alias
import { z } from 'genkit';

const GenerateCharacterBackstoryInputSchema = z.object({
  race: z.string().describe('The race of the character.'),
  class: z.string().describe('The class of the character.'),
  alignment: z.string().describe('The alignment of the character.'),
});
export type GenerateCharacterBackstoryInput = z.infer<typeof GenerateCharacterBackstoryInputSchema>;

const GenerateCharacterBackstoryOutputSchema = z.object({
  backstory: z.string().describe('The generated backstory for the character.'),
});
export type GenerateCharacterBackstoryOutput = z.infer<typeof GenerateCharacterBackstoryOutputSchema>;

export async function generateCharacterBackstory(
  input: GenerateCharacterBackstoryInput
): Promise<GenerateCharacterBackstoryOutput> {
  return generateCharacterBackstoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCharacterBackstoryPrompt',
  input: {
    schema: z.object({
      race: z.string().describe('The race of the character.'),
      class: z.string().describe('The class of the character.'),
      alignment: z.string().describe('The alignment of the character.'),
    }),
  },
  output: {
    schema: z.object({
      backstory: z.string().describe('The generated backstory for the character.'),
    }),
  },
  prompt: `You are a fantasy writer specialized in D&D backstories.

  Generate a character backstory based on the following information:

  Race: {{{race}}}
  Class: {{{class}}}
  Alignment: {{{alignment}}}
  `,
});

const generateCharacterBackstoryFlow = ai.defineFlow<
  typeof GenerateCharacterBackstoryInputSchema,
  typeof GenerateCharacterBackstoryOutputSchema
>({
  name: 'generateCharacterBackstoryFlow',
  inputSchema: GenerateCharacterBackstoryInputSchema,
  outputSchema: GenerateCharacterBackstoryOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});
