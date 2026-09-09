"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Home, 
  ChefHat, 
  Truck, 
  Users, 
  Menu, 
  Calculator,
  User
} from "lucide-react";
import { useSidebar } from "./SidebarContext";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { toggleSidebar, isOpen } = useSidebar();
  const [role, setRole] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email === "fschottenfeld@gmail.com") {
          setRole("admin");
        } else if (user.email === "cocina@supercatering.com" || user.email === "alpaso.algalope@gmail.com") {
          setRole("cocina");
        } else {
          setRole(user.app_metadata?.role || user.user_metadata?.role || "cocina");
        }
      }
    }
    loadUser();
  }, []);

  let navItems = [
    { href: "/dashboard", label: "Inicio", icon: Home },
    { href: "/produccion", label: "Cocina", icon: ChefHat },
    { href: "/inventario/ordenes-compra", label: "Compras", icon: Truck },
    { href: "/rrhh", label: "RRHH ", icon: Users },
  ];

  if (role === "cocina") {
    navItems = [
      { href: "/dashboard", label: "Inicio", icon: Home },
      { href: "/produccion", label: "Cocina", icon: ChefHat },
      { href: "/inventario/ordenes-compra", label: "Compras", icon: Truck },
      { href: "/inventario/proyeccion", label: "Insumos", icon: Calculator },
    ];
  } else if (role === "empleado") {
    navItems = [
      { href: "/rrhh/portal", label: "Mi Portal", icon: User },
    ];
  }
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden transition-all duration-200 pb-safe">
      <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-all group min-w-[54px] ${
                isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <div className={`p-1.5 rounded-2xl transition-all ${
                isActive ? "bg-indigo-50 text-indigo-600 scale-105 shadow-2xs" : "text-slate-500"
              }`}>
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              </div>
              <span className={`text-[10px] tracking-tight font-black uppercase mt-0.5 truncate max-w-full ${
                isActive ? "text-indigo-600 font-black" : "text-slate-500 font-semibold"
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Menu Button to toggle Sidebar Drawer */}
        <button
          onClick={toggleSidebar}
          type="button"
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-all cursor-pointer min-w-[54px] ${
            isOpen ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
          }`}
          aria-label="Abrir menú completo"
        >
          <div className={`p-1.5 rounded-2xl transition-all ${
            isOpen ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105" : "bg-slate-100 text-slate-700"
          }`}>
            <Menu size={20} strokeWidth={2.2} />
          </div>
          <span className={`text-[10px] tracking-tight font-black uppercase mt-0.5 ${
            isOpen ? "text-indigo-600 font-black" : "text-slate-700 font-bold"
          }`}>
            Menú
          </span>
        </button>
      </div>
    </nav>
  );
}
