"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isOpen: boolean;
  toggleSidebar: () => void;
  setIsOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: true,
  toggleSidebar: () => {},
  setIsOpen: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_open");
      if (saved !== null) {
        setIsOpen(saved === "true");
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggleSidebar = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_open", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleSetIsOpen = (open: boolean) => {
    setIsOpen(open);
    try {
      localStorage.setItem("sidebar_open", String(open));
    } catch {
      // Ignore
    }
  };

  return (
    <SidebarContext.Provider value={{ isOpen, toggleSidebar, setIsOpen: handleSetIsOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
