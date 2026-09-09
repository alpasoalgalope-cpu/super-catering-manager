"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isOpen: boolean;
  toggleSidebar: () => void;
  setIsOpen: (open: boolean) => void;
  closeSidebar: () => void;
  openSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: true,
  toggleSidebar: () => {},
  setIsOpen: () => {},
  closeSidebar: () => {},
  openSidebar: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setIsOpen(false);
      } else {
        const saved = localStorage.getItem("sidebar_open");
        setIsOpen(saved !== null ? saved === "true" : true);
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggleSidebar = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        if (window.innerWidth >= 768) {
          localStorage.setItem("sidebar_open", String(next));
        }
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleSetIsOpen = (open: boolean) => {
    setIsOpen(open);
    try {
      if (window.innerWidth >= 768) {
        localStorage.setItem("sidebar_open", String(open));
      }
    } catch {
      // Ignore
    }
  };

  const closeSidebar = () => handleSetIsOpen(false);
  const openSidebar = () => handleSetIsOpen(true);

  return (
    <SidebarContext.Provider 
      value={{ 
        isOpen, 
        toggleSidebar, 
        setIsOpen: handleSetIsOpen,
        closeSidebar,
        openSidebar
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
