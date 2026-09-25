import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'Viandas Regreso | Logística Gastronómica para Viajes a Recitales y Eventos',
  description: 'Solución gastronómica integral y logística para viajes a recitales y eventos masivos. Entregas directas en River, Vélez, Movistar Arena y La Plata.',
  openGraph: {
    title: 'Viandas Regreso | Logística Gastronómica para Eventos',
    description: 'Optimizá la experiencia de tus pasajeros y sumá ingresos extra sin ocuparte de la comida ni de la logística.',
    url: 'https://viandas-regreso.com.ar',
    siteName: 'Viandas Regreso',
    locale: 'es_AR',
    type: 'website',
  },
}

export default function Home() {
  return <LandingPage />
}