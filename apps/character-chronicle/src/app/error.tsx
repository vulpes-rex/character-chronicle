'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'; // Use alias
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { AlertCircle } from 'lucide-react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service or console
    // TODO: Replace console.error with a proper server-side logging service if available
    console.error("Unhandled Application Error:", error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
       <Card className="w-full max-w-md">
        <CardHeader className="text-center">
           <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
           <CardTitle className="text-2xl text-destructive">Application Error</CardTitle>
           <CardDescription>Something went wrong. Please try again.</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
           <p>We encountered an unexpected issue.</p>
           {/* Optionally display error details in development */}
           {process.env.NODE_ENV === 'development' && (
             <pre className="mt-4 text-xs text-left bg-muted p-2 rounded overflow-auto max-h-40">
                <code>{error?.message}\n{error?.stack}</code>
             </pre>
           )}
        </CardContent>
        <CardFooter className="flex justify-center">
           <Button onClick={() => reset()}>
             Try Again
           </Button>
        </CardFooter>
       </Card>
    </div>
  )
}
