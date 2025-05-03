"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(
  ({ className, ...props }, ref) => (
    
  
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(
  ({ className, ...props }, ref) => (
    
  
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(
  ({ className, ...props }, ref) => (
    
  
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
