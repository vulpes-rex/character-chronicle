
// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
   experimental: {
     serverActions: {
       bodySizeLimit: '2mb', // Or appropriate limit
     },
     // Ensure serverComponentsExternalPackages is set up if using libraries
     // that need specific handling in Server Components (like Firebase Admin SDK if used).
     // For client-side Firebase SDK (firebase/app, firebase/firestore), this usually isn't needed.
     // serverComponentsExternalPackages: ['@google-cloud/firestore'], // Example
   },
    webpack: (config) => {
       config.resolve.extensionAlias = { '.js': ['.js', '.jsx'], '.ts': ['.ts', '.tsx'] };
       return config;
     },

   output: 'standalone', // Optimize for deployment environments
};

export default nextConfig;
