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
} from '@/components/ui/sidebar'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import { Users, UserPlus, LogIn, LogOut, Shield, ScrollText, Settings, ShieldCheck, BookOpen, Bot, Swords, UserRoundCog } from 'lucide-react'; // Added UserRoundCog
import { BackstoryGenerator } from './backstory-generator'; // Use alias
import type { Character } from '@/lib/types'; // Use alias
import { useToast } from '@/hooks/use-toast'; // Use alias
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'; // Use alias
import { Skeleton } from './ui/skeleton'; // Use alias
import { DiceRollProvider } from './dice-roll-context'; // Use alias
import { DDDiceLoader } from './dddice-loader'; // Corrected import path
import { FloatingDiceRoller } from './floating-dice-roller'; // Import the floating roller


export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, userProfile, loading, isAdmin } = useAuth(); // Get auth state

  const characterIdMatch = pathname.match(/^\/character\/(view|edit)\/([a-zA-Z0-9_-]+)/);
  const currentCharacterId = characterIdMatch ? characterIdMatch[2] : undefined;

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
    <DiceRollProvider> {/* Wrap with DiceRollProvider */}
      <SidebarProvider defaultOpen>
        <Sidebar side="left" collapsible="icon">
          <SidebarHeader className="items-center gap-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
               {/* <Dices className="h-6 w-6" /> */} {/* Replaced with SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M17.1 3.1C16.5 2.5 15.5 2 14 2H6C4.9 2 4 2.9 4 4v8c0 1.5 2.5 2.9 3.1 3.5c0.6 0.6 1.5 1 3 1h8c1.1 0 2-0.9 2-2v-8C22 5.5 19.5 3.1 18.9 2.5z"/><path d="M17 11h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H17c0.3 0 0.5-0.2 0.5-0.5S17.3 11 17 11z"/><path d="M14 8h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H14c0.3 0 0.5-0.2 0.5-0.5S14.3 8 14 8z"/><path d="M11 5h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H11c0.3 0 0.5-0.2 0.5-0.5S11.3 5 11 5z"/></svg>
               <span className="group-data-[collapsible=icon]:hidden">Character Chronicle</span>
            </Link>
            <SidebarTrigger className="ml-auto group-data-[collapsible=icon]:ml-0"/>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
               {/* Character Management - Visible only if logged in and not DM */}
               {user && !isAdmin && (
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
                            {/* Pass only characterId, BackstoryGenerator handles fetching if needed */}
                            <BackstoryGenerator characterId={currentCharacterId} />
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
            <DDDiceLoader /> {/* Ensure DDDiceLoader is here */}
            <FloatingDiceRoller /> {/* Add the floating dice roller */}
        </SidebarInset>
      </SidebarProvider>
    </DiceRollProvider>
  );
}
