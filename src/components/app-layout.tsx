'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
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
import { ScrollText, UserSquare, Dices } from 'lucide-react';
import { BackstoryGenerator } from './backstory-generator';
import { LevelUpPrompt } from './level-up-prompt';

export function AppLayout({ children }: { children: ReactNode }) {
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
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={{ children: 'Character Sheet' }}
              >
                <Link href="/">
                  <UserSquare />
                  <span>Character Sheet</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <LevelUpPrompt />
            </SidebarMenuItem>
             <SidebarMenuItem>
                <BackstoryGenerator />
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
