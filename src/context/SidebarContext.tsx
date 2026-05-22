import { createContext, useContext, useState, useEffect } from "react";

type SidebarContextType = {
  isExpanded: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  isPinned: boolean;
  activeItem: string | null;
  openSubmenu: string | null;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  setIsHovered: (isHovered: boolean) => void;
  setIsPinned: (isPinned: boolean) => void;
  setActiveItem: (item: string | null) => void;
  toggleSubmenu: (item: string) => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("sidebar-expanded");
    return saved === null ? true : saved === "true";
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("sidebar-pinned");
    return saved === null ? true : saved === "true";
  });
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("sidebar-expanded", String(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("sidebar-pinned", String(isPinned));
  }, [isPinned]);

  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (!next) {
        setIsPinned(false);
      }
      return next;
    });
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const toggleSubmenu = (item: string) => {
    setOpenSubmenu((prev) => (prev === item ? null : item));
  };

  return (
    <SidebarContext.Provider
      value={{
        isExpanded: isMobile ? false : isExpanded,
        isMobileOpen,
        isHovered,
        isPinned: isMobile ? false : isPinned,
        activeItem,
        openSubmenu,
        toggleSidebar,
        toggleMobileSidebar,
        setIsHovered,
        setIsPinned,
        setActiveItem,
        toggleSubmenu,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};
