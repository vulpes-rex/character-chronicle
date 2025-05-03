
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';
import { AuthProvider } from '@/components/auth-provider'; // Import AuthProvider
import React, { Suspense } from 'react'; // Import Suspense
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for loading fallback
import { DDDiceRoller } from '@/components/dddice-roller'; // Corrected import name from DDDiceLoader to DDDiceRoller
import { DiceRollProvider } from '@/components/dice-roll-context'; // Ensure provider wraps the layout

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Character Chronicle',
  description: 'Manage your D&D 5e characters',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark"> {/* Default to dark mode */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
           <AuthProvider> {/* Wrap children with AuthProvider */}
             <DiceRollProvider> {/* Wrap relevant parts with DiceRollProvider */}
                {/* Wrap children in Suspense for potential loading states */}
                 <Suspense fallback={<RootLoadingSkeleton />}>
                     <DDDiceRoller /> {/* Render the visualizer component */}
                    {children}
                 </Suspense>
              </DiceRollProvider>
           </AuthProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

// Simple loading skeleton for the root layout fallback
function RootLoadingSkeleton() {
   return (
      <div className="flex h-screen w-screen items-center justify-center">
          <Skeleton className="h-16 w-16 rounded-full animate-spin" />
      </div>
   )
}
