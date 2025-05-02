
'use client';

import { useEffect, useCallback } from 'react'; // Import useCallback
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PartialCharacterFormData } from './character-creation-wizard';

const step1Schema = z.object({
    playerName: z.string().min(1, 'Player Name is required'),
    characterName: z.string().min(1, 'Character Name is required'),
});

type Step1FormData = z.infer<typeof step1Schema>;

interface Step1Props {
    data: PartialCharacterFormData;
    updateData: (data: Partial<Step1FormData>) => void;
    setValidity: (isValid: boolean) => void;
}

export function Step1BasicInfo({ data, updateData, setValidity }: Step1Props) {
    const { register, handleSubmit, watch, formState: { errors, isValid: formIsValid }, trigger } = useForm<Step1FormData>({
        resolver: zodResolver(step1Schema),
        mode: 'onChange', // Validate on change
        defaultValues: {
            playerName: data.playerName || '',
            characterName: data.characterName || '',
        },
    });

    const watchedFields = watch(); // Watch all fields

    // Update parent component's data state whenever form data changes and is valid
    useEffect(() => {
        // Check if the watched fields actually changed from the parent's data
        const changed = watchedFields.playerName !== data.playerName || watchedFields.characterName !== data.characterName;

        if (changed) {
             console.log("Step 1: Updating parent data"); // Debug log
            updateData(watchedFields);
        }
    }, [watchedFields.playerName, watchedFields.characterName, updateData, data.playerName, data.characterName]); // Depend on specific watched fields and updateData

    // Update parent component's validity state whenever form validity changes
    useEffect(() => {
         setValidity(formIsValid);
         // Trigger initial validation once on mount
         if (!formIsValid) {
             trigger(); // Trigger validation on mount only if initially invalid
         }
    }, [formIsValid, setValidity, trigger]);


    // No actual submit needed here, data is passed up via updateData on change
    const onSubmit = (formData: Step1FormData) => {
        // This function is technically not needed if we update on change
        // console.log("Step 1 Data:", formData);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}> {/* Can keep form tag for structure */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="playerName">Player Name</Label>
                        <Input
                            id="playerName"
                            {...register('playerName')}
                            placeholder="Your Name"
                            aria-invalid={errors.playerName ? "true" : "false"}
                        />
                        {errors.playerName && <p className="text-xs text-destructive">{errors.playerName.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="characterName">Character Name</Label>
                        <Input
                            id="characterName"
                            {...register('characterName')}
                            placeholder="Character's Name"
                            aria-invalid={errors.characterName ? "true" : "false"}
                        />
                        {errors.characterName && <p className="text-xs text-destructive">{errors.characterName.message}</p>}
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
