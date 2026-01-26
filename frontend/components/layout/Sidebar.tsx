"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, LogOut, Sprout } from "lucide-react"
import { cn } from "@/lib/utils"

const Sidebar = () => {
    const pathname = usePathname()

    const navItems = [
        { href: "/dashboard", label: "Página inicial", icon: LayoutDashboard },
        { href: "/patients", label: "Pacientes", icon: Users },
    ]

    return (
        <aside className="hidden h-screen w-[220px] flex-col bg-white border-r border-transparent md:flex fixed left-0 top-0 z-50 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
            {/* Logo Area */}
            <div className="flex h-[72px] items-center px-6">
                <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-[#1DBF73]">
                    <Sprout className="h-7 w-7 fill-current" />
                    <span className="text-[#1DBF73]">NutriApp</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 py-6 px-3">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-r-full px-4 py-3 text-sm font-medium transition-all duration-200 border-l-4",
                                isActive
                                    ? "border-[#1DBF73] bg-[#F0FDF4] text-[#1DBF73]"
                                    : "border-transparent text-gray-500 hover:text-[#1DBF73] hover:bg-gray-50"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive ? "text-[#1DBF73]" : "text-gray-400")} />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>
        </aside>
    )
}

export default Sidebar
