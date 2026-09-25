'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Bus,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Clock,
  Sparkles,
  DollarSign,
  Users,
  MapPin,
  ChevronDown,
  Menu,
  X,
  Lock,
  LogIn,
  Loader2,
  Mail,
  Utensils,
  Award,
  Truck,
  FileCheck,
  Phone,
  MessageCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react'

// WhatsApp Link Generator
const WHATSAPP_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5491135109772'
const DEFAULT_WA_MESSAGE = 'Hola! Quiero sumar Viandas Regreso a los viajes de mi empresa de traslados/turismo.'

function getWhatsAppUrl(customText?: string) {
  const text = customText || DEFAULT_WA_MESSAGE
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`
}

export default function LandingPage() {
  const router = useRouter()
  const supabase = createClient()

  // State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [activeFaq, setActiveFaq] = useState<number | null>(null)

  // Quick Login State inside Modal
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Quick Login Handler
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      setLoginError('Credenciales incorrectas. Verificá tu usuario y contraseña.')
      setLoginLoading(false)
    } else {
      setLoginModalOpen(false)
      router.push('/dashboard')
      router.refresh()
    }
  }

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white antialiased font-sans">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP NOTIFICATION / TRUST BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border-b border-indigo-500/20 px-4 py-2 text-xs font-semibold text-center text-indigo-200 flex items-center justify-center gap-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>
          <strong>Temporada de Recitales 2026:</strong> Cupos de logística abiertos para River, Vélez, Movistar Arena y La Plata.
        </span>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVBAR / HEADER
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-indigo-400/30 group-hover:scale-105 transition-transform">
              <Bus className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white block leading-none">
                VIANDAS <span className="text-indigo-400 font-extrabold">REGRESO</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mt-1">
                Logística Gastronómica para Eventos
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#como-funciona" className="hover:text-indigo-400 transition-colors">
              Cómo Funciona
            </a>
            <a href="#beneficios" className="hover:text-indigo-400 transition-colors">
              Beneficios B2B
            </a>
            <a href="#alianzas" className="hover:text-indigo-400 transition-colors flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300">
              <Sparkles className="w-3.5 h-3.5" />
              Alianzas B2B
            </a>
            <a href="#venues" className="hover:text-indigo-400 transition-colors">
              Estadios & Venues
            </a>
            <a href="#faqs" className="hover:text-indigo-400 transition-colors">
              Preguntas Frecuentes
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {/* Operator Login Button */}
            <button
              onClick={() => setLoginModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-all shadow-sm"
              title="Ingreso a panel de gestión operativa"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Acceso Operadores</span>
            </button>

            {/* WhatsApp Commercial CTA */}
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 rounded-xl shadow-lg shadow-emerald-950/40 border border-emerald-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-white/20" />
              <span>Contactar WhatsApp</span>
            </a>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setLoginModalOpen(true)}
              className="p-2 text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold"
              title="Acceso"
            >
              <Lock className="w-4 h-4 text-indigo-400" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 border-b border-slate-800 px-6 py-6 space-y-4 backdrop-blur-2xl">
            <a
              href="#como-funciona"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-semibold text-slate-200 hover:text-indigo-400"
            >
              Cómo Funciona
            </a>
            <a
              href="#beneficios"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-semibold text-slate-200 hover:text-indigo-400"
            >
              Beneficios B2B
            </a>
            <a
              href="#alianzas"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-bold text-emerald-400 hover:text-emerald-300"
            >
              ✨ Alianzas B2B
            </a>
            <a
              href="#venues"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-semibold text-slate-200 hover:text-indigo-400"
            >
              Estadios & Venues
            </a>
            <a
              href="#faqs"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-semibold text-slate-200 hover:text-indigo-400"
            >
              Preguntas Frecuentes
            </a>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Hablar por WhatsApp</span>
              </a>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  setLoginModalOpen(true)
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl"
              >
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Acceso Operadores / Interno</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          3. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Glow & Backdrop Accents */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Value Proposition */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Category Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-extrabold uppercase tracking-widest shadow-sm">
                <Truck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Para Empresas de Traslados, Combis y Turismo</span>
              </div>

              {/* H1 Main Heading */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12]">
                Solución gastronómica integral y logística para viajes a{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400">
                  recitales y eventos masivos.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg sm:text-xl text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Optimizá la experiencia de tus pasajeros y{' '}
                <span className="text-emerald-400 font-bold">sumá ingresos extra</span> sin ocuparte de la comida, cobros ni de la logística en el estadio.
              </p>

              {/* Dual CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 text-sm font-black uppercase tracking-wider text-white bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 rounded-2xl shadow-xl shadow-emerald-950/50 border border-emerald-400/40 hover:scale-[1.03] active:scale-[0.98] transition-all group"
                >
                  <MessageCircle className="w-5 h-5 fill-white/20 group-hover:scale-110 transition-transform" />
                  <span>Quiero sumar Viandas Regreso</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>

                <a
                  href="#como-funciona"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 text-sm font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 rounded-2xl transition-all shadow-md"
                >
                  <span>Conocé cómo funciona</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </a>
              </div>

              {/* Trust Badges Bar */}
              <div className="pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/60">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base font-black text-white">+10.000</div>
                    <div className="text-[11px] font-medium text-slate-400 leading-tight">Viandas entregadas en eventos</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/60">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base font-black text-white">Directo en Venues</div>
                    <div className="text-[11px] font-medium text-slate-400 leading-tight">River, Vélez, Movistar, La Plata</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/60">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base font-black text-white">Cadena de Frío</div>
                    <div className="text-[11px] font-medium text-slate-400 leading-tight">Packaging individual sellado</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Product Showcase Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Decorative glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-[2.5rem] blur-xl opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>

                <div className="relative bg-slate-900/90 border border-slate-800 rounded-[2.2rem] p-6 shadow-2xl backdrop-blur-xl overflow-hidden space-y-5">
                  
                  {/* Card Header Status */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                        Logística Activa en Venue
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-full">
                      Punto de Encuentro
                    </span>
                  </div>

                  {/* Visual Combo Photo / Mock */}
                  <div className="relative h-48 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                    <Image
                      src="/images/ciabatta_combo.jpg"
                      alt="Combo Vianda Regreso - Ciabatta Artesanal y Bebida"
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <span className="bg-slate-950/90 backdrop-blur-md text-white text-[11px] font-black px-3 py-1 rounded-lg border border-slate-700/80">
                        🥖 Ciabatta Masa Madre & Bebida 500ml
                      </span>
                      <span className="bg-emerald-500/90 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        Recién Elaborado
                      </span>
                    </div>
                  </div>

                  {/* Highlights list */}
                  <div className="space-y-2.5 text-xs text-slate-300">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <span className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        Entrega en mano al coordinador del micro
                      </span>
                      <span className="text-emerald-400 font-bold">23:45 hs</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <span className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        Opciones Clásica, Veggie y Sin TACC certificada
                      </span>
                      <span className="text-indigo-400 font-bold">100% Sellado</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <span className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        Cero desvíos ni esperas en estaciones de servicio
                      </span>
                      <span className="text-amber-400 font-bold">0 Demoras</span>
                    </div>
                  </div>

                  {/* Micro Operator Proof Tag */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80">
                    <span className="flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5 text-indigo-400" />
                      Compatible con flotas de 1 a 30+ micros
                    </span>
                    <span className="font-bold text-slate-200">
                      Viandas listas al subir
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. CÓMO FUNCIONA (EL PROCESO PARA LA EMPRESA)
      ───────────────────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-20 bg-slate-900/50 border-y border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-3.5 py-1.5 rounded-full inline-block">
              Simplicidad Total
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              ¿Cómo funciona? Cero trabajo administrativo para tu empresa.
            </h2>
            <p className="text-slate-400 text-base font-medium">
              Diseñamos el circuito para que el organizador o dueño de la flota no tenga que anotar listas, cobrar dinero ni desviarse de la ruta.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-8 relative flex flex-col justify-between hover:border-indigo-500/50 transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-black text-indigo-500/30 font-mono group-hover:text-indigo-400/60 transition-colors">
                    01
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Bus className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-xl font-black text-white">
                  Te damos tu link exclusivo por micro
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Creamos un enlace de compra personalizado con el nombre de tu empresa y el show específico. Solo tenés que reenviarlo al grupo de WhatsApp de tus pasajeros.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Un solo click para compartir
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-8 relative flex flex-col justify-between hover:border-emerald-500/50 transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-black text-emerald-500/30 font-mono group-hover:text-emerald-400/60 transition-colors">
                    02
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-xl font-black text-white">
                  Los pasajeros compran y pagan online
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Cada pasajero elige su sándwich (Clásico, Vegetariano o Sin TACC apto celíaco) y lo abona con tarjeta o Mercado Pago antes de viajar. Vos no manejás efectivo ni hacés cobros.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Cobro individual garantizado
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-8 relative flex flex-col justify-between hover:border-sky-500/50 transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-black text-sky-500/30 font-mono group-hover:text-sky-400/60 transition-colors">
                    03
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <MapPin className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-xl font-black text-white">
                  Entregamos en el estadio antes de subir
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Al finalizar el show, nuestro equipo acerca los bultos rotulados al punto de encuentro o directamente a la puerta de tu micro. Los pasajeros viajan cenando en el regreso a casa.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Cero desvíos ni paradas de más
              </div>
            </div>
          </div>

          {/* Bottom Step Callout */}
          <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">
                  ¿Querés probar el circuito en tu próximo viaje a River o Vélez?
                </span>
                <span className="text-xs text-slate-400">
                  Te habilitamos el link de tu empresa en menos de 10 minutos.
                </span>
              </div>
            </div>

            <a
              href={getWhatsAppUrl('Hola! Quiero activar un link de Viandas Regreso para un viaje próximo.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold uppercase tracking-wider shrink-0 transition-colors shadow-lg shadow-indigo-950/50"
            >
              <span>Activar mi Link</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. BENEFICIOS CLAVE PARA LA EMPRESA (B2B)
      ───────────────────────────────────────────────────────────── */}
      <section id="beneficios" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3.5 py-1.5 rounded-full inline-block">
              Propuesta de Valor B2B
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Diseñado exclusivamente para hacer crecer tu empresa de traslados.
            </h2>
            <p className="text-slate-400 text-base font-medium">
              Transformá el catering de un problema operativo a un beneficio tangible: rentabilidad directa, comida asegurada para el chofer y pasajeros satisfechos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Beneficio 1 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 hover:border-emerald-500/40 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                Ingreso extra sin esfuerzo
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Percibí una comisión económica neta por cada vianda que tus pasajeros compran. Cero inversión inicial, cero riesgo y liquidación transparente luego del evento.
              </p>
            </div>

            {/* Beneficio 2 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 hover:border-indigo-500/40 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                Liberados para la tripulación
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Tus choferes y coordinadores viajan con la comida resuelta y bonificada. Un beneficio muy valorado que reduce tus costos operativos de viáticos.
              </p>
            </div>

            {/* Beneficio 3 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 hover:border-amber-500/40 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Utensils className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                Menús adaptados a la ruta
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Packaging individual reforzado antiderrames, sándwiches que no humedecen el pan, pan fresco horneado el mismo día y cadena de frío garantizada hasta la entrega.
              </p>
            </div>

            {/* Beneficio 4 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 hover:border-sky-500/40 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                Cero dolor de cabeza
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Nosotros gestionamos pedidos de celíacos certificados, dietas vegetarianas, coordinación horaria en la desconcentración y consultas directas de pasajeros.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. ACUERDOS COMERCIALES A MEDIDA (B2B)
      ───────────────────────────────────────────────────────────── */}
      <section id="alianzas" className="py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-y border-slate-800/80 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            
            {/* Glow accent */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 text-center max-w-3xl mx-auto space-y-4 mb-10">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Alianzas Estratégicas B2B
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Condiciones comerciales diseñadas a la medida de tu flota.
              </h2>
              <p className="text-slate-300 text-sm sm:text-base font-medium leading-relaxed">
                Cada empresa de traslados cuenta con distintas dinámicas, rutas y volúmenes de pasajeros. Establecemos esquemas personalizados y acuerdos convenientes para potenciar la rentabilidad de tus viajes.
              </p>
            </div>

            {/* 3 Pillars */}
            <div className="relative z-10 grid md:grid-cols-3 gap-6 mb-10">
              <div className="bg-slate-950/70 border border-slate-800/80 p-6 rounded-2xl space-y-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white">Comisiones por Viaje</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Esquemas de rentabilidad directa acordados según la escala de tus viajes, con liquidaciones claras y transparentes al finalizar cada evento.
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 p-6 rounded-2xl space-y-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white">Tripulación Cubierta</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Viandas bonificadas para los choferes y coordinadores de tus unidades, asegurando su cena sin incrementar tus costos de viáticos.
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 p-6 rounded-2xl space-y-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white">Logística Dedicada</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Coordinación personalizada con tu equipo en el venue para entregas exactas en puerta de micro, sin demoras ni trámites previos.
                </p>
              </div>
            </div>

            {/* Direct CTA */}
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href={getWhatsAppUrl('Hola! Me gustaría conversar sobre una propuesta comercial de Viandas Regreso para los viajes de mi empresa de traslados.')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 text-xs font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:to-emerald-400 rounded-2xl shadow-xl shadow-emerald-950/60 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <MessageCircle className="w-4 h-4 fill-slate-950" />
                <span>Solicitar Propuesta para mi Empresa</span>
              </a>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. SECCIÓN DE VENUES Y EVENTOS (PRUEBA SOCIAL)
      ───────────────────────────────────────────────────────────── */}
      <section id="venues" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-sky-400 bg-sky-950/80 border border-sky-500/30 px-3.5 py-1.5 rounded-full inline-block">
              Cobertura Operativa Comprobada
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Presentes en los estadios y predios más importantes del país.
            </h2>
            <p className="text-slate-400 text-base font-medium">
              Conocemos las zonas de espera de micros, los accesos autorizados y los tiempos de desconcentración en cada sede para garantizar entregas en tiempo y forma.
            </p>
          </div>

          {/* Venues Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'Estadio River Plate', loc: 'Monumental - Núñez', badge: 'Estacionamiento Figueroa Alcorta / Udaondo' },
              { name: 'Movistar Arena', loc: 'Villa Crespo - CABA', badge: 'Zona Humboldt / Corrientes' },
              { name: 'Estadio Vélez Sarsfield', loc: 'Liniers - CABA', badge: 'Zona Reservada Juan B. Justo' },
              { name: 'Estadio Único La Plata', loc: 'La Plata - Bs. As.', badge: 'Av. 25 y 528 / Predio' },
              { name: 'Hipódromo San Isidro', loc: 'Lollapalooza & Festivales', badge: 'Av. Márquez / Rolón' },
              { name: 'Tecnópolis / Polo', loc: 'CABA & Gran Buenos Aires', badge: 'Zona General Paz /标志性' },
            ].map((v, i) => (
              <div
                key={i}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-center flex flex-col justify-between hover:border-indigo-500/40 hover:bg-slate-900 transition-all group"
              >
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black text-white leading-tight">
                    {v.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {v.loc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <span className="text-[10px] font-mono text-emerald-400 block leading-tight font-bold">
                    ✓ Punto de Entrega Validado
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Product Quality Mosaic / Gallery */}
          <div className="mt-16 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-10">
            <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
              <h3 className="text-xl font-black text-white">
                Excelencia en cada detalle: Embalaje y Calidad Industrial
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Garantizamos máxima higiene, presentación premium y respeto absoluto de las normas bromatológicas.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-2xl">📦</div>
                <div className="text-sm font-bold text-white">Bultos rotulados de a 10</div>
                <p className="text-[11px] text-slate-400">
                  Agrupados y fajados para que el coordinador identifique al instante cada menú sin abrir cajas.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-2xl">🥖</div>
                <div className="text-sm font-bold text-white">Pan artesanal del día</div>
                <p className="text-[11px] text-slate-400">
                  Ciabattas y pebetes seleccionados que resisten la humedad sin desarmarse durante el trayecto.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-2xl">🌾</div>
                <div className="text-sm font-bold text-white">Certificación Sin TACC</div>
                <p className="text-[11px] text-slate-400">
                  Viandas celíacas envasadas al vacío en origen, rotuladas y completamente libres de contaminación cruzada.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-2xl">❄️</div>
                <div className="text-sm font-bold text-white">Cadena de Frío Estricta</div>
                <p className="text-[11px] text-slate-400">
                  Conservación en cámaras frigoríficas y transporte térmico hasta el minuto previo a la entrega.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. TESTIMONIOS / PRUEBA SOCIAL DE OPERADORES
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-slate-900/30 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex text-amber-400 text-xs">★★★★★</div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                &ldquo;Viajamos a todos los recitales de River y Vélez. Antes parábamos en estaciones de servicio colapsadas y perdíamos horas. Ahora los pasajeros cenan arriba del micro y nosotros generamos un ingreso extra por viaje.&rdquo;
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px]">
                <div className="font-bold text-white">Operador de Turismo & Traslados</div>
                <div className="text-slate-500">Rosario &bull; Flota de 4 micros</div>
              </div>
            </div>

            <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex text-amber-400 text-xs">★★★★★</div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                &ldquo;El tema de los celíacos y vegetarianos siempre era un problema. Con Viandas Regreso viene todo sellado y rotulado con nombre. Cero quejas de los pasajeros y los choferes viajan tranquilos con su comida resuelta y bonificada.&rdquo;
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px]">
                <div className="font-bold text-white">Coordinador General de Viajes</div>
                <div className="text-slate-500">Córdoba Capital &bull; Shows masivos</div>
              </div>
            </div>

            <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex text-amber-400 text-xs">★★★★★</div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                &ldquo;Lo mejor es que nosotros no cobramos nada. Les pasamos el link al grupo del micro y ellos pagan con Mercado Pago. Al terminar el show nos entregan las cajas en la ventanilla del micro. Impecable.&rdquo;
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px]">
                <div className="font-bold text-white">Empresa de Traslados Privados</div>
                <div className="text-slate-500">Santa Fe &bull; Movistar Arena & La Plata</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. FAQS RÁPIDAS (ACORDEÓN INTERACTIVO)
      ───────────────────────────────────────────────────────────── */}
      <section id="faqs" className="py-20 bg-slate-900/50 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4 mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-3.5 py-1.5 rounded-full inline-block">
              Despejá tus Dudas
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Preguntas Frecuentes
            </h2>
            <p className="text-slate-400 text-sm font-medium">
              Respuestas rápidas para dueños de empresas de traslados, coordinadores y pasajeros.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: '¿Qué incluye cada vianda?',
                a: 'Cada vianda incluye un sándwich artesanal en pan ciabatta de masa madre o pebete gourmet (con abundante jamón y queso, vegetales frescos según opción), sobres individuales de aderezos, servilletas y papel parafinado térmico. También se puede incluir agua mineral individual sin gas de 500ml.'
              },
              {
                q: '¿Cómo se gestionan las dietas especiales (celiaquía, vegetarianos)?',
                a: 'Contamos con opciones vegetarianas y opciones celíacas Sin TACC elaboradas en laboratorio certificado libre de gluten, termoselladas en origen y con envasado al vacío para evitar cualquier tipo de contaminación cruzada.'
              },
              {
                q: '¿Con cuánta anticipación cerramos las listas de pedidos?',
                a: 'Los links de compra para pasajeros cierran entre 24 y 48 horas antes de cada evento. Esto nos permite producir la cantidad exacta y asegurar frescura absoluta sin desperdicios ni faltantes.'
              },
              {
                q: '¿Cómo se coordina la entrega en el estadio o venue?',
                a: 'Nuestro equipo logístico se comunica vía WhatsApp y ubicación GPS en tiempo real con el coordinador o chofer de tu micro. Acordamos el punto de estacionamiento exacto y entregamos los bultos rotulados al finalizar el recital, listos para la partida.'
              },
              {
                q: '¿Tiene algún costo o compromiso mínimo para la empresa de traslados?',
                a: 'Ninguno. No hay costos fijos, membresías ni inversión inicial. Tu empresa solo comparte el enlace en el grupo de viaje; nosotros nos encargamos del cobro, producción y entrega, liquidando tu comisión pactada.'
              },
              {
                q: '¿Qué pasa si el recital se retrasa o termina más tarde de lo previsto?',
                a: 'Nuestro equipo permanece apostado en el venue hasta la desconcentración total del público. La entrega está 100% coordinada con el horario real de finalización del show.'
              }
            ].map((faq, index) => {
              const isOpen = activeFaq === index
              return (
                <div
                  key={index}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-white hover:text-indigo-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-indigo-400 shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. FINAL CTA / CONVERSION BANNER
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-950 opacity-80" />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            Empezá a monetizar tus viajes hoy
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            ¿Tenés viajes programados a los próximos shows?<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400">
              Sumá Viandas Regreso y mejorá tu servicio.
            </span>
          </h2>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
            Hablemos por WhatsApp y te creamos el link para tus micros en el día. Sin contratos engorrosos ni trámites complejos.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={getWhatsAppUrl('Hola! Tengo micros programados para los próximos eventos y quiero empezar a trabajar con Viandas Regreso.')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-9 py-4 text-sm font-black uppercase tracking-wider text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 rounded-2xl shadow-xl shadow-emerald-950/60 border border-emerald-400/40 hover:scale-105 active:scale-95 transition-all"
            >
              <MessageCircle className="w-5 h-5 fill-white/20" />
              <span>Chatear con un Asesor Comercial</span>
            </a>

            <button
              onClick={() => setLoginModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 text-sm font-bold text-slate-300 hover:text-white bg-slate-900/90 border border-slate-700/80 rounded-2xl transition-all"
            >
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>Acceso Operadores</span>
            </button>
          </div>

          {/* Passenger Notice Box */}
          <div className="pt-8 max-w-md mx-auto">
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl text-xs text-slate-400">
              <span className="font-bold text-slate-200 block mb-1">
                ¿Sos pasajero y buscabas tu link de compra?
              </span>
              Pedíselo directamente al coordinador o empresa de turismo con la que viajas. Cada micro tiene su enlace propio asignado.
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          11. FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Col 1: Brand */}
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                  VR
                </div>
                <span className="text-base font-black text-white tracking-tight">
                  VIANDAS <span className="text-indigo-400">REGRESO</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Logística gastronómica integral para empresas de traslados, combis y contingentes turísticos hacia eventos y recitales masivos.
              </p>
              <div className="text-[11px] text-slate-500">
                Operado bajo los estándares de Super Catering &bull; Al Paso y Al Galope.
              </div>
            </div>

            {/* Col 2: Enlaces rápidos */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Navegación
              </span>
              <ul className="space-y-1.5 text-slate-400">
                <li><a href="#como-funciona" className="hover:text-white transition-colors">Cómo Funciona</a></li>
                <li><a href="#beneficios" className="hover:text-white transition-colors">Beneficios B2B</a></li>
                <li><a href="#alianzas" className="hover:text-white transition-colors">Alianzas B2B</a></li>
                <li><a href="#venues" className="hover:text-white transition-colors">Venues y Estadios</a></li>
                <li><a href="#faqs" className="hover:text-white transition-colors">Preguntas Frecuentes</a></li>
              </ul>
            </div>

            {/* Col 3: Contacto */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Contacto Comercial
              </span>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    +54 9 11 3510-9772 (WhatsApp)
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <a href="mailto:alpaso.algalope@gmail.com" className="hover:text-white transition-colors">
                    alpaso.algalope@gmail.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Buenos Aires, Argentina</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Discreet Internal Login Link */}
          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
            <div>
              &copy; {new Date().getFullYear()} Viandas Regreso (viandas-regreso.com.ar). Todos los derechos reservados.
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={() => setLoginModalOpen(true)}
                className="hover:text-slate-300 transition-colors flex items-center gap-1.5"
              >
                <Lock className="w-3 h-3 text-slate-500" />
                <span>Acceso Interno / Admin</span>
              </button>
            </div>
          </div>

        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          12. OPERATOR / ADMIN QUICK LOGIN MODAL
      ───────────────────────────────────────────────────────────── */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            
            {/* Close Button */}
            <button
              onClick={() => setLoginModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">
                Acceso Operadores
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Panel interno de gestión logística, producción y eventos
              </p>
            </div>

            {/* Error message */}
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Email Operativo
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="usuario@viandas-regreso.com.ar"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Ingresar al Sistema</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer link to regular login page */}
            <div className="text-center pt-2 border-t border-slate-800/80">
              <Link
                href="/login"
                onClick={() => setLoginModalOpen(false)}
                className="text-[11px] text-slate-500 hover:text-indigo-400 transition-colors"
              >
                ¿Problemas para ingresar? Abrir pantalla completa de login &rarr;
              </Link>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
