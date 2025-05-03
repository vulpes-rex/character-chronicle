'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button'; // Use alias
import { Input } from '@/components/ui/input'; // Use alias
import { Textarea } from '@/components/ui/textarea'; // Use alias
import { Label } from '@/components/ui/label'; // Use alias
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Use alias
import { useToast } from '@/hooks/use-toast'; // Use alias
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider'; // Use alias
import { Loader2, PackagePlus } from 'lucide-react';
import type { SourcePack } from '@/lib/types'; // Use alias
import { saveSourcePackAction } from '@/app/actions/campaign-actions'; // Use Server Action

// Define Zod schema for the form data
const contentPackFormSchema = z.object({
  name: z.string().min(1, { message: 'Pack name is required.' }).max(100),
  description: z.string().max(500).optional(),
  // TODO: Add fields for editing content (races, classes, items, etc.)
  // This will likely involve complex nested forms or separate editing interfaces.
  // For now, just basic info.
  // content: z.any().optional(), // Placeholder for complex content editing
});

type ContentPackFormData = z.infer<typeof contentPackFormSchema>;

interface ContentPackFormProps {
  initialData?: SourcePack; // For editing existing packs
}

export function ContentPackForm({ initialData }: ContentPackFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ContentPackFormData>({
    resolver: zodResolver(contentPackFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      // content: initialData?.content || {}, // Load initial content if editing
    },
  });

  async function onSubmit(data: ContentPackFormData) {
    if (!user || !isAdmin) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in as a DM to save a content pack.' });
      return;
    }
    setIsLoading(true);

    // Construct the full SourcePack object to save
    const packDataToSave: Omit<SourcePack, 'createdAt' | 'updatedAt' | 'id'> & { id?: string } = {
      ...data,
      creatorId: initialData?.creatorId || user.uid, // Keep original creator or set current user
      content: initialData?.content || {}, // Preserve existing content or start empty
      ...(initialData && { id: initialData.id }), // Add id if updating
    };


    try {
       const result = await saveSourcePackAction(packDataToSave, user.uid);

       if (result.success) {
           toast({
             title: initialData ? 'Content Pack Updated' : 'Content Pack Created',
             description: `Pack "${data.name}" saved successfully.`,
           });
           // Redirect to the content management page
           router.push('/dm/content');
           router.refresh(); // Refresh server components if needed
       } else {
           throw new Error(result.error || 'An unknown error occurred.');
       }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Could not save the content pack.',
      });
    } finally {
      setIsLoading(false);
    }
  }

   if (authLoading) {
       return <Loader2 className="h-8 w-8 animate-spin" />; // Or a skeleton loader
   }
   if (!user || !isAdmin) {
       return <p>You do not have permission to manage content packs.</p>;
   }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{initialData ? 'Edit Content Pack' : 'Create New Content Pack'}</CardTitle>
            <CardDescription>
              {initialData ? 'Update the details for your content pack.' : 'Fill in the details for your new content pack.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pack Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter pack name (e.g., Homebrew Heroes)" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the content of this pack..." {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* TODO: Add Content Editing Section */}
            <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Pack Content</h3>
                <p className="text-sm text-muted-foreground">
                    Content editing (races, classes, items, monsters, NPCs, spells) is not yet implemented in this form.
                    Use a dedicated editor or manage the JSON data directly for now.
                </p>
                {/* Placeholder for future content editing UI */}
            </div>

          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || authLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? 'Update Pack Info' : 'Create Pack'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

    