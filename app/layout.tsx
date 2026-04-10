import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Phoenix Portal | VaShawn F. HEAD',
  description: 'Real-time QR dashboard with WebSocket + Next.js + Shopify',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}