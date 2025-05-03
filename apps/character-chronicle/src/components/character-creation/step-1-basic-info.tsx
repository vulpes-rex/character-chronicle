'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { PartialCharacterFormData } from './character-creation-wizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Input } from '@/components/ui/input'; // Use alias
import { Label } from '@/components/ui/label'; // Use alias
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Use alias
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Use alias

// Schema for Step 1 data
const step1Schema = z.object({
    playerName: z.string().min(1, 'Player name is required.'),
    characterName: z.string().min(1, 'Character name is required.'),
    alignment: z.string().min(1, 'Alignment is required.'),
    // campaignId: z.string().optional(), // Optional: Select campaign at creation?
});

type Step1FormData = z.infer<typeof step1Schema>;

interface Step1BasicInfoProps {
    data: PartialCharacterFormData;
    updateData: (newData: Partial<Step1FormData>) => void;
    setValidity: (isValid: boolean) => void;
    // campaigns: Campaign[]; // Pass available campaigns if selection is needed
    // isLoadingCampaigns: boolean;
}

const ALIGNMENTS = [
    'Lawful Good', 'Neutral Good', 'Chaotic Good',
    'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
    'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'
];

export function Step1BasicInfo({ data, updateData, setValidity }: Step1BasicInfoProps) {
    const form = useForm<Step1FormData>({
        resolver: zodResolver(step1Schema),
        defaultValues: {
            playerName: data.playerName || '',
            characterName: data.characterName || '',
            alignment: data.alignment || '',
            // campaignId: data.campaignId || '',
        },
        mode: 'onChange', // Validate on change to update validity state
    });

    const { register, control, watch, formState: { errors, isValid } } = form;

    // Watch for changes and update the parent component's data
    useEffect(() => {
        const subscription = watch((value) => {
            updateData(value);
            setValidity(isValid);
        });
        return () => subscription.unsubscribe();
    }, [watch, updateData, setValidity, isValid]);

     // Initial validity check
     useEffect(() => {
        setValidity(isValid);
     }, [isValid, setValidity]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Enter the fundamental details for your character.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form className="space-y-6">
                         <FormField
                            control={control}
                            name="playerName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Player Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Your name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                         <FormField
                            control={control}
                            name="characterName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Character Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Character's name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                         <FormField
                            control={control}
                            name="alignment"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Alignment</FormLabel>
                                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                                         <FormControl>
                                             <SelectTrigger>
                                                <SelectValue placeholder="Select alignment..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                             {ALIGNMENTS.map(align => (
                                                 <SelectItem key={align} value={align}>
                                                     {align}
                                                 </SelectItem>
                                             ))}
                                        </SelectContent>
                                     </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                         {/* Optional Campaign Selection */}
                         {/* <FormField
                            control={control}
                            name="campaignId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Campaign (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select campaign..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                             <SelectItem value="">None</SelectItem>
                                            {campaigns.map(camp => (
                                                <SelectItem key={camp.id} value={camp.id}>
                                                    {camp.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>Assign character to a campaign.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        /> */}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
