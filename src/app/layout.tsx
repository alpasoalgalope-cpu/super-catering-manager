import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Super Catering Manager',
  description: 'Gastronomic operations management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
