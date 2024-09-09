import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Sportly — Book Sports Fields & Play Together',
  description:
    'Find and book sports fields near you. Create group sessions, invite players, and track your rankings.',
};

export const viewport: Viewport = {
  maximumScale: 1,
};

const manrope = Manrope({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`bg-white text-black dark:bg-gray-950 dark:text-white ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-gray-50">
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
