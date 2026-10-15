import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { PwaRegister } from '@/components/pwa-register';

const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'Agro',
  description: 'Fundação da plataforma de gestão agrícola',
  appleWebApp: { capable: true, title: 'Agro', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#176442',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
