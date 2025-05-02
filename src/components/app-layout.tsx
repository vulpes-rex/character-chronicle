'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth'; // Import signOut
import { auth } from '@/lib/firebase'; // Import auth instance
import { useAuth } from '@/components/auth-provider'; // Import useAuth hook
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
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Dices, LogIn, LogOut, Shield, ScrollText, Settings, ShieldCheck, BookOpen, Bot, Swords, UserRoundCog } from 'lucide-react'; // Added UserRoundCog
import { BackstoryGenerator } from './backstory-generator';
import type { Character } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'; // For user display
import { Skeleton } from './ui/skeleton'; // Import Skeleton component
import { useQuery } from '@tanstack/react-query';
import { loadCharacter } from '@/services/character-service';
import { FloatingDiceRoller } from './floating-dice-roller';

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, userProfile, loading, isAdmin } = useAuth(); // Get auth state

  const characterIdMatch = pathname.match(/^\/character\/(view|edit)\/([a-zA-Z0-9_-]+)/);
  const currentCharacterId = characterIdMatch ? characterIdMatch[2] : undefined;

  // Pre-fetch character data if ID is present, useful for BackstoryGenerator
   const { data: currentCharacter } = useQuery<Character | null, Error>({
       queryKey: ['character', currentCharacterId],
       queryFn: () => currentCharacterId ? loadCharacter(currentCharacterId) : Promise.resolve(null), // Use client-safe fetcher or wrap server action
       enabled: !!currentCharacterId && !!user, // Only fetch if we have an ID and user is logged in
       staleTime: 5 * 60 * 1000, // Cache for 5 minutes
   });


  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login'); // Redirect to login page after logout
    } catch (error) {
      console.error("Logout failed:", error);
      toast({ variant: 'destructive', title: 'Logout Failed', description: 'Could not log you out. Please try again.' });
    }
  };

  const getInitials = (name?: string | null): string => {
     if (!name) return '?';
     const names = name.split(' ');
     if (names.length === 1) return names[0].charAt(0).toUpperCase();
     return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

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
             {/* Character Management - Visible only if logged in */}
             {user && (
                <>
                     <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={{ children: 'Character List' }}
                        isActive={pathname === '/'}
                      >
                        <Link href="/">
                          <Users />
                          <span>Characters</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={{ children: 'Create New Character' }}
                        isActive={pathname === '/character/create'}
                      >
                        <Link href="/character/create">
                          <UserPlus />
                          <span>Create Character</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                          <BackstoryGenerator
                             characterId={currentCharacterId}
                             characterRace={currentCharacter?.race}
                             characterClass={currentCharacter?.class}
                             characterAlignment={currentCharacter?.alignment}
                         />
                     </SidebarMenuItem>
                     <SidebarSeparator />
                 </>
             )}


             {/* Campaign Management (Visible to all logged-in users, DM sees more options) */}
             {user && (
                 <>
                     <SidebarMenuItem>
                       <SidebarMenuButton
                         asChild
                         tooltip={{ children: 'Campaigns' }}
                         isActive={pathname.startsWith('/campaign')}
                       >
                         <Link href="/campaigns">
                           <BookOpen />
                           <span>Campaigns</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                 </>
             )}


             {/* DM-Specific Section */}
             {isAdmin && (
                 <>
                    <SidebarSeparator />
                     <SidebarMenuItem>
                       <SidebarMenuButton
                         asChild
                         tooltip={{ children: 'Create Campaign' }}
                          isActive={pathname === '/dm/campaigns/create'}
                       >
                         <Link href="/dm/campaigns/create">
                           <ShieldCheck />
                           <span>Create Campaign</span>
                         </Link>
                       </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                       <SidebarMenuButton
                         asChild
                         tooltip={{ children: 'Manage Encounters' }}
                          isActive={pathname.startsWith('/dm/encounters')}
                       >
                         <Link href="/dm/encounters"> {/* Link to encounters page */}
                           <Swords />
                           <span>Encounters</span>
                         </Link>
                       </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                       <SidebarMenuButton
                         asChild
                         tooltip={{ children: 'Manage Content' }}
                          isActive={pathname.startsWith('/dm/content')}
                       >
                         <Link href="/dm/content">
                           <Settings />
                           <span>Manage Content</span>
                         </Link>
                       </SidebarMenuButton>
                    </SidebarMenuItem>
                    {/* <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            tooltip={{ children: 'Manage NPCs' }} // Placeholder for potential dedicated NPC management page
                            isActive={pathname.startsWith('/dm/npcs')}
                        >
                            <Link href="/dm/content">  Link back to content for now
                                <UserRoundCog />
                                <span>Manage NPCs</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem> */}
                 </>
             )}

          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 mt-auto border-t border-sidebar-border">
           {loading ? (
                <div className="flex items-center gap-2 p-2">
                   <Skeleton className="h-8 w-8 rounded-full" />
                   <Skeleton className="h-4 w-24" />
                </div>
           ) : user && userProfile ? (
               <div className="flex items-center justify-between gap-2 p-1">
                 <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8">
                       {/* Add AvatarImage if user has a photoURL */}
                       <AvatarFallback>{getInitials(userProfile.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                         <span className="text-sm font-medium truncate">{userProfile.displayName || 'User'}</span>
                         <span className="text-xs text-muted-foreground">{userProfile.role === 'dm' ? 'Dungeon Master' : 'Player'}</span>
                    </div>
                 </div>
                 <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 group-data-[collapsible=icon]:ml-auto"
                    onClick={handleLogout}
                    title="Log Out"
                 >
                    <LogOut />
                 </Button>
               </div>
           ) : (
             <Button variant="default" className="w-full" asChild>
                <Link href="/login">
                   <LogIn className="mr-2 h-4 w-4" /> Log In
                </Link>
             </Button>
           )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
         {children}
         <FloatingDiceRoller />
      </SidebarInset>
    </SidebarProvider>
  );
}

