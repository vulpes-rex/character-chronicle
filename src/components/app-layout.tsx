
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // To check if on a character page
// Removed unused useQuery import
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
import type { Character } from '@/lib/types'; // Keep Character type for BackstoryGenerator props

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Keep this logic if BackstoryGenerator relies on the ID even without loading data here
  const characterIdMatch = pathname.match(/^\/character\/(view|edit)\/([a-zA-Z0-9_-]+)/);
  const currentCharacterId = characterIdMatch ? characterIdMatch[2] : undefined;

  // Removed the problematic useQuery hook.
  // Character data is loaded on the respective pages (view/edit)
  // and can be passed down or accessed via context/state management if needed globally.

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
                 {/* Pass only the ID if needed, or rely on context/page data */}
                 {/* The props for race/class/alignment will likely be undefined here now */}
                 {/* BackstoryGenerator needs to handle potentially missing props gracefully */}
                 <BackstoryGenerator characterId={currentCharacterId} />
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
