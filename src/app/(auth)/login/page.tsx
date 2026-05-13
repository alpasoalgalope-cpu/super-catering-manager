"use client"

import React, { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Lock, Mail, Loader2, ChefHat, ShieldCheck } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.log("Auth Error Details:", authError)
      setError("Credenciales inválidas. Por favor intente de nuevo.")
      setLoading(false)
    } else {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/40 via-slate-50 to-emerald-50/40">
      <div className="max-w-md w-full">
        {/* LOGO AREA */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white shadow-xl border border-slate-100 mb-6 text-indigo-600">
            <ChefHat size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Super Catering</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] italic">Gestión & Logística Operativa</p>
        </div>

        {/* LOGIN CARD */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-100/50 border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
             <ShieldCheck size={120} className="text-indigo-600" />
          </div>

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Corporativo</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-bold text-slate-700"
                  placeholder="admin@supercatering.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-bold text-slate-700"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold text-center animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl shadow-lg shadow-slate-200 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-3"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>Acceder al Sistema</>
              )}
            </button>

            <div className="text-center pt-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                ¿Primer acceso? <a href="/register" className="text-indigo-600 hover:underline">Crear cuenta de Admin</a>
              </p>
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <p className="text-center mt-8 text-slate-400 text-xs font-bold uppercase tracking-widest">
          &copy; 2026 Super Catering Manager
        </p>
      </div>
    </div>
  )
}
