'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // Correct import
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function Providers({ children }: { children: React.ReactNode }) {
    // Use useState to ensure QueryClient is only created once per component instance
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // Default query options can go here
                staleTime: 1000 * 60 * 5, // 5 minutes
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {/* React Query Devtools (optional, useful for development) */}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
