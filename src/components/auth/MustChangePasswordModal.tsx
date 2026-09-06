"use client"

import React, { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Lock, ShieldCheck, AlertCircle, Loader2 } from "lucide-react"

export default function MustChangePasswordModal() {
  const [mustChange, setMustChange] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function checkUserMetadata() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.user_metadata?.must_change_password === true) {
        setMustChange(true)
      }
    }
    checkUserMetadata()
  }, [])

  if (!mustChange) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          must_change_password: false
        }
      })

      if (updateErr) throw updateErr

      setSuccess(true)
      setTimeout(() => {
        setMustChange(false)
      }, 1500)
    } catch (err: any) {
      setError(err.message || "Error al actualizar la contraseña.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 text-slate-800 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
            Primer Acceso al Sistema
          </h2>
          <p className="text-xs font-medium text-slate-500">
            Por motivos de seguridad, debes definir tu contraseña personal y privada antes de continuar navegando.
          </p>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-50 text-emerald-700 rounded-2xl text-center space-y-2">
            <ShieldCheck size={36} className="mx-auto text-emerald-600 animate-bounce" />
            <p className="font-black text-xs uppercase tracking-wider">¡Contraseña actualizada con éxito!</p>
            <p className="text-[11px] font-medium">Ingresando al sistema...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Nueva Contraseña
              </label>
              <input 
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Confirmar Contraseña
              </label>
              <input 
                type="password"
                required
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-xs"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Guardar mi Contraseña"}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
