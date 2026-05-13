"use client"

import { seedKitchenUser } from "@/app/actions/auth"
import { useState } from "react"

export default function SeedKitchenFinalPage() {
  const [status, setStatus] = useState("Listo para crear el usuario...")

  const handleSeed = async () => {
    setStatus("Creando...")
    const { data, error } = await seedKitchenUser()
    if (error) {
      setStatus("Error: " + JSON.stringify(error))
    } else {
      setStatus("Usuario creado: " + JSON.stringify(data))
    }
  }

  return (
    <div className="p-20 text-center">
      <h1 className="text-2xl font-bold mb-4">{status}</h1>
      <button 
        onClick={handleSeed}
        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold"
      >
        Crear Usuario Cocina AHORA
      </button>
    </div>
  )
}
