
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // To check if on a character page
import { useQuery } from '@tanstack/react-query';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Dices } from 'lucide-react';
import { BackstoryGenerator } from './backstory-generator';
import type { Character } from '@/lib/types'; // Import Character type

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const characterIdMatch = pathname.match(/^\/character\/(view|edit)\/([a-zA-Z0-9_-]+)/);
  const currentCharacterId = characterIdMatch ? characterIdMatch[2] : undefined;

  // Optionally fetch character data here if needed globally in the layout,
  // or rely on page components to fetch and potentially pass down props.
  // Fetching here might be inefficient if not always needed.
  const { data: currentCharacter } = useQuery<Character, Error>({
      queryKey: ['character', currentCharacterId],
      // queryFn: () => loadCharacter(currentCharacterId!), // Assumes loadCharacter is client-compatible or wrapped
      enabled: !!currentCharacterId, // Only fetch if we have an ID
      staleTime: 5 * 60 * 1000,
  });


  return (
    <SidebarProvider defaultOpen>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader className="items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
             <Dices className="h-6 w-6" />
             <span className="group-data-[collapsible=icon]:hidden">Character Chronicle</span>
          </Link>
          <SidebarTrigger className="ml-auto group-data-[collapsible=icon]:ml-0"/>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {/* Link to Character List (Homepage) */}
             <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={{ children: 'Character List' }}
              >
                <Link href="/">
                  <Users />
                  <span>Characters</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

             {/* Link to Create Character Page */}
             <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={{ children: 'Create New Character' }}
              >
                <Link href="/character/create">
                  <UserPlus />
                  <span>Create Character</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>


             <SidebarMenuItem>
                 {/* Pass relevant details from the potentially loaded character */}
                 <BackstoryGenerator
                    characterId={currentCharacter?.id}
                    characterRace={currentCharacter?.race}
                    characterClass={currentCharacter?.class}
                    characterAlignment={currentCharacter?.alignment}
                />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
            {/* Footer content if needed */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
