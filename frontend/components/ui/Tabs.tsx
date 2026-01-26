import * as React from "react"
import { cn } from "@/lib/utils"

export const Tabs = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={className}>{children}</div>
)

export const TabsList = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={cn("flex space-x-6 border-b", className)}>{children}</div>
)

export const TabsTrigger = ({
    active,
    onClick,
    children,
    className
}: {
    active?: boolean,
    onClick?: () => void,
    children: React.ReactNode,
    className?: string
}) => (
    <button
        onClick={onClick}
        className={cn(
            "pb-3 text-sm font-medium transition-colors border-b-2",
            active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            className
        )}
    >
        {children}
    </button>
)

export const TabsContent = ({ active, children, className }: { active?: boolean, children: React.ReactNode, className?: string }) => {
    if (!active) return null;
    return <div className={cn("py-4", className)}>{children}</div>
}
