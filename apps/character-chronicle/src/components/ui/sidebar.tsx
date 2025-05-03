"use client"

import { Slot } from "@radix-ui/react-slot" // Correct import
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LogOut,
  type LucideIcon,
  MoreHorizontal,
  Settings,
} from "lucide-react"
import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile" // Correct import path
import { cn } from "@/lib/utils" // Use alias

import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button, type ButtonProps } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { ScrollArea } from "./scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

interface SidebarContextProps {
  open: boolean
  setOpen: (open: boolean) => void
  collapsible: "none" | "icon" | "full"
  side: "left" | "right"
}

const SidebarContext = React.createContext<SidebarContextProps | undefined>(undefined)

const useSidebar = () => {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

interface SidebarProviderProps {
  children: React.ReactNode
  defaultOpen?: boolean
  collapsible?: "none" | "icon" | "full"
  side?: "left" | "right"
}

export const SidebarProvider = ({ children, defaultOpen = false, collapsible = "full", side = "left" }: SidebarProviderProps) => {
  const [open, setOpen] = React.useState(defaultOpen)

  return <SidebarContext.Provider value={{ open, setOpen, collapsible, side }}>{children}</SidebarContext.Provider>
}

export const Sidebar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const { open, collapsible, side } = useSidebar()
  const isMobile = useIsMobile()

  const sideClass = side === "left" ? "left-0" : "right-0"
  const collapsedClass = open
    ? "w-72 border-r"
    : collapsible === "icon"
      ? "w-[52px] border-r"
      : collapsible === "full"
        ? "w-0"
        : "w-72 border-r"

  // Full collapse should hide the sidebar entirely on mobile initially
  const mobileCollapsedClass = collapsible === "full" ? "w-0" : collapsedClass

  return (
    <div
      ref={ref}
      className={cn(
        "fixed top-0 h-screen transition-all duration-300 ease-in-out group bg-sidebar text-sidebar-foreground data-[collapsible=icon]:duration-200",
        isMobile ? mobileCollapsedClass : collapsedClass,
        sideClass,
        className
      )}
      data-collapsed={!open}
      data-collapsible={collapsible}
      {...props}
    />
  )
})
Sidebar.displayName = "Sidebar"

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex h-14 items-center border-b border-sidebar-border p-2", className)} {...props} />
))
SidebarHeader.displayName = "SidebarHeader"

export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <ScrollArea ref={ref} className={cn("flex-1 overflow-y-auto", className)} {...props} />
))
SidebarContent.displayName = "SidebarContent"

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-auto border-t border-sidebar-border p-2", className)} {...props} />
))
SidebarFooter.displayName = "SidebarFooter"

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn("space-y-1", className)} {...props} />
))
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("relative", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

export const SidebarSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("my-2 h-px bg-sidebar-border", className)} {...props} />
))
SidebarSeparator.displayName = "SidebarSeparator"

interface SidebarTriggerProps extends ButtonProps {}

export const SidebarTrigger = React.forwardRef<HTMLButtonElement, SidebarTriggerProps>(({ className, ...props }, ref) => {
  const { open, setOpen, collapsible, side } = useSidebar()
  const Icon = side === "left" ? open ? ChevronLeft : ChevronRight : open ? ChevronRight : ChevronLeft

  if (collapsible === "none") return null

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={() => setOpen(!open)}
      title={open ? "Collapse Sidebar" : "Expand Sidebar"}
      {...props}
    >
      <Icon />
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

export const SidebarInset = ({ children }: { children: React.ReactNode }) => {
  const { open, collapsible } = useSidebar()
  const isMobile = useIsMobile()

  const paddingClass = open
    ? "pl-72"
    : collapsible === "icon"
      ? "pl-[52px]"
      : collapsible === "full"
        ? "pl-0"
        : "pl-72"
  const mobilePaddingClass = collapsible === "full" ? "pl-0" : paddingClass

  return <div className={cn("transition-all duration-300 ease-in-out group-data-[collapsible=icon]:duration-200", isMobile ? mobilePaddingClass : paddingClass)}>{children}</div>
}

// Tooltip wrapper component
interface SidebarTooltipProps {
  children: React.ReactNode
  tooltip?: React.ReactNode | { children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }
}

const SidebarTooltip = ({ children, tooltip }: SidebarTooltipProps) => {
  const { open, collapsible } = useSidebar()

  if (!tooltip || open || collapsible === "none") {
    return <>{children}</>
  }

  const tooltipContent = typeof tooltip === "object" && "children" in tooltip ? tooltip.children : tooltip
  const tooltipSide = typeof tooltip === "object" && "side" in tooltip ? tooltip.side : "right"

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={tooltipSide} sideOffset={4}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Sidebar Button Component
interface SidebarButtonProps extends Omit<ButtonProps, "title"> {
  asChild?: boolean
  isActive?: boolean
  tooltip?: React.ReactNode | { children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }
}

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarButtonProps>(
  ({ className, variant = "ghost", size = "sm", asChild = false, isActive, tooltip, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const { open, collapsible } = useSidebar()

    const content = (
      <Comp
        ref={ref}
        className={cn(
          "w-full justify-start gap-2 text-sidebar-foreground",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
          collapsible === "icon" && !open && "h-10 w-10 justify-center p-0", // Icon only when collapsed
          className
        )}
        variant={variant}
        size={collapsible === "icon" && !open ? "icon" : size}
        {...props}
      >
        {children}
      </Comp>
    )

    return <SidebarTooltip tooltip={tooltip}>{content}</SidebarTooltip>
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"
