import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { SessionProvider } from '@/components/providers/session-provider';
import { authOptions } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'NaijaMarket Intel | Admin Dashboard',
  description: 'Operations Control Center for NaijaMarket Intel - The Bloomberg of Nigerian Commodities',
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dash-bg antialiased">
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
