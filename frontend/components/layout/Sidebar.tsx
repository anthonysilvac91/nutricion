"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Users, LogOut, Sprout } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { getUserFromToken } from "@/lib/auth"

const TIPS = [
    "Hidratate bien y elige alimentos frescos y naturales.",
    "Incluye 5 porciones de frutas y verduras al día.",
    "Prefiere granos integrales sobre refinados.",
]

const Sidebar = () => {
    const pathname = usePathname()
    const router   = useRouter()
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
    ]
    if (role === "ADMIN") {
        navItems.push({ href: "/admin/nutritionists", label: "Nutricionistas", icon: Users })
    }

    return (
        <aside className="hidden h-screen w-55 flex-col bg-white border-r border-transparent md:flex fixed left-0 top-0 z-50 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
            {/* Logo */}
            <div className="flex h-18 items-center px-6 shrink-0">
                <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-[#1DBF73]">
                    <Sprout className="h-7 w-7 fill-current" />
                    <span>NutriApp</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 py-4 px-3 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-[#F0FDF4] text-[#1DBF73]"
                                    : "text-gray-500 hover:text-[#1DBF73] hover:bg-gray-50"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive ? "text-[#1DBF73]" : "text-gray-400")} />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            {/* Consejo del día */}
            <div className="mx-3 mb-3 rounded-2xl bg-linear-to-b from-[#F0FDF4] to-[#dcfce7] p-4 relative overflow-hidden shrink-0">
                {/* Decorative plant */}
                <div className="absolute right-2 bottom-0 opacity-20 pointer-events-none select-none text-[60px] leading-none">
                    🌿
                </div>
                <p className="text-[11px] font-bold text-[#1DBF73] uppercase tracking-widest mb-1">Consejo del día</p>
                <p className="text-xs text-gray-600 leading-relaxed pr-6 min-h-10">
                    {TIPS[tipIdx]}
                </p>
                {/* Dot pagination */}
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

            {/* Cerrar sesión */}
            <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 mx-3 mb-4 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 shrink-0"
            >
                <LogOut className="h-5 w-5" />
                Cerrar sesión
            </button>
        </aside>
    )
}

export default Sidebar
