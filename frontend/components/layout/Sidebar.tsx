"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Users, LogOut, Sprout, Apple, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { getUserFromToken } from "@/lib/auth"
import { useSidebar } from "@/lib/sidebar-context"

const TIPS = [
    "Hidratate bien y elige alimentos frescos y naturales.",
    "Incluye 5 porciones de frutas y verduras al día.",
    "Prefiere granos integrales sobre refinados.",
]

const Sidebar = () => {
    const pathname          = usePathname()
    const router            = useRouter()
    const { collapsed, toggle } = useSidebar()
    const [role, setRole]   = useState<string | null>(null)
    const [tipIdx, setTipIdx] = useState(0)

    useEffect(() => {
        const user = getUserFromToken()
        if (user) setRole(user.role)
    }, [])

    const handleLogout = () => {
        localStorage.removeItem("token")
        router.push("/login")
    }

    const navItems = [
        { href: "/dashboard", label: "Página inicial", icon: LayoutDashboard },
        { href: "/patients",  label: "Pacientes",      icon: Users },
        { href: "/foods",     label: "Alimentos",      icon: Apple },
    ]
    if (role === "ADMIN") {
        navItems.push({ href: "/admin/nutritionists", label: "Nutricionistas", icon: Users })
    }

    return (
        <aside className={cn(
            "hidden h-screen flex-col bg-white border-r border-transparent md:flex fixed left-0 top-0 z-50 shadow-[2px_0_10px_rgba(0,0,0,0.02)] transition-all duration-300",
            collapsed ? "w-16" : "w-55"
        )}>
            {/* Logo + toggle */}
            <div className="flex h-18 items-center shrink-0 px-3 justify-between">
                <div className={cn(
                    "flex items-center gap-2 font-bold text-xl tracking-tight text-[#1DBF73] overflow-hidden transition-all duration-300",
                    collapsed ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100"
                )}>
                    <Sprout className="h-7 w-7 fill-current shrink-0" />
                    <span className="whitespace-nowrap">NutriApp</span>
                </div>

                {collapsed && (
                    <div className="flex w-full justify-center">
                        <Sprout className="h-6 w-6 fill-current text-[#1DBF73]" />
                    </div>
                )}

                <button
                    type="button"
                    onClick={toggle}
                    className={cn(
                        "shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#1DBF73] hover:bg-gray-50 transition-all cursor-pointer",
                        collapsed && "ml-auto"
                    )}
                    title={collapsed ? "Expandir menú" : "Colapsar menú"}
                >
                    {collapsed
                        ? <ChevronRight className="h-4 w-4" />
                        : <ChevronLeft className="h-4 w-4" />
                    }
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 py-4 px-2 overflow-y-auto overflow-x-hidden">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200",
                                collapsed ? "justify-center gap-0" : "gap-3",
                                isActive
                                    ? "bg-[#F0FDF4] text-[#1DBF73]"
                                    : "text-gray-500 hover:text-[#1DBF73] hover:bg-gray-50"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#1DBF73]" : "text-gray-400")} />
                            <span className={cn(
                                "whitespace-nowrap overflow-hidden transition-all duration-300",
                                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </nav>

            {/* Consejo del día — solo en modo expandido */}
            {!collapsed && (
                <div className="mx-3 mb-3 rounded-2xl bg-linear-to-b from-[#F0FDF4] to-[#dcfce7] p-4 relative overflow-hidden shrink-0">
                    <div className="absolute right-2 bottom-0 opacity-20 pointer-events-none select-none text-[60px] leading-none">
                        🌿
                    </div>
                    <p className="text-[11px] font-bold text-[#1DBF73] uppercase tracking-widest mb-1">Consejo del día</p>
                    <p className="text-xs text-gray-600 leading-relaxed pr-6 min-h-10">
                        {TIPS[tipIdx]}
                    </p>
                    <div className="flex gap-1 mt-3">
                        {TIPS.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setTipIdx(i)}
                                className={cn(
                                    "h-1.5 rounded-full transition-all",
                                    i === tipIdx ? "w-4 bg-[#1DBF73]" : "w-1.5 bg-gray-300"
                                )}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Cerrar sesión */}
            <button
                type="button"
                onClick={handleLogout}
                title={collapsed ? "Cerrar sesión" : undefined}
                className={cn(
                    "flex items-center mx-2 mb-4 px-3 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 shrink-0",
                    collapsed ? "justify-center" : "gap-3"
                )}
            >
                <LogOut className="h-5 w-5 shrink-0" />
                <span className={cn(
                    "whitespace-nowrap overflow-hidden transition-all duration-300",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                )}>
                    Cerrar sesión
                </span>
            </button>
        </aside>
    )
}

export default Sidebar
