
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';
import { AuthProvider } from '@/components/auth-provider'; // Import AuthProvider

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
  description: 'Manage your D\&D 5e characters',
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
                {children}
           </AuthProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
