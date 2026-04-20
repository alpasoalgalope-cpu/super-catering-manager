"use client"

import { useState } from "react"
import ProductModal from "./ProductModal"

export default function NewProductButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="rounded-md bg-[#7FB3D5] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#6FA3C5]"
      >
        + Nuevo Producto
      </button>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
