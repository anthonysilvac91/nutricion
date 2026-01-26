import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "primary" | "secondary" | "success"
    size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
                    {
                        "bg-primary text-white hover:bg-[#4570EA] shadow-lg shadow-primary/40": variant === "default" || variant === "primary",
                        "border border-input bg-background hover:bg-secondary hover:text-secondary-foreground": variant === "outline",
                        "bg-transparent hover:bg-secondary hover:text-primary": variant === "ghost",
                        "bg-[#FA896B] text-white hover:bg-[#FA896B]/90": variant === "destructive",
                        "bg-[#13DEB9] text-white hover:bg-[#13DEB9]/90": variant === "success",
                        "h-10 px-4 py-2 rounded-lg": size === "default",
                        "h-8 rounded-lg px-3 text-xs": size === "sm",
                        "h-12 rounded-lg px-8 text-base": size === "lg",
                        "h-10 w-10": size === "icon",
                    },
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
