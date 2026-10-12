import type { Metadata, Viewport } from 'next';
import ThemeRegistry from '@/components/ThemeRegistry/ThemeRegistry';
import ServiceWorkerRegister from '@/components/PWA/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'StudyFlow — Organizacja zadań i macierz Eisenhowera',
  description: 'Aplikacja do organizacji zadań akademickich z interaktywną macierzą Eisenhowera',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'StudyFlow',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body>
        <ThemeRegistry>
          <ServiceWorkerRegister />
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}

