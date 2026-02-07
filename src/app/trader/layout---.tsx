import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'NaijaMarket Intel - Trader Portal',
  description: 'Submit commodity prices and earn rewards as a NaijaMarket Intel trader',
  manifest: '/trader/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NaijaMarket Trader',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#14532d',
};

export default function TraderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="trader-layout">
      {children}
    </div>
  );
}
