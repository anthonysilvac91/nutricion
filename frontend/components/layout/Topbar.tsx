"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ChevronDown, LogOut, FlaskConical, Database } from "lucide-react"
import { getUserFromToken, DecodedToken } from "@/lib/auth"
import { useMockMode } from "@/lib/mock-mode-context"

const Topbar = () => {
    const router   = useRouter()
    const pathname = usePathname()
    const menuRef  = useRef<HTMLDivElement>(null)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [user, setUser]             = useState<DecodedToken | null>(null)
    const { isMock, toggle }          = useMockMode()

    const isDashboard = pathname === "/dashboard"
    const roleName    = user?.role
        ? user.role.charAt(0) + user.role.slice(1).toLowerCase()
        : "Nutricionista"

    useEffect(() => { setUser(getUserFromToken()) }, [])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleLogout = () => {
        localStorage.removeItem("token")
        router.push("/login")
    }

    const displayName = user?.email ?? "Usuario"
    const initials    = displayName.slice(0, 2).toUpperCase()

    return (
        <header className="sticky top-0 z-40 h-18 bg-[#F3F6F8]/90 backdrop-blur-sm">
            <div className="w-full px-8 flex items-center justify-between h-full">

                {/* Left: greeting on dashboard only */}
                {isDashboard ? (
                    <div>
                        <h1 className="text-xl font-bold text-[#2A3547] leading-tight">
                            ¡Hola, {roleName}! <span>👋</span>
                        </h1>
                        <p className="text-xs text-gray-400 mt-0.5">Este es el resumen de tu consulta de hoy.</p>
                    </div>
                ) : (
                    <span />
                )}

                {/* Right: toggle + profile */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={toggle}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all shadow-sm
                            ${isMock
                                ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                                : "bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300"
                            }`}
                    >
                        {isMock
                            ? <><FlaskConical className="h-3.5 w-3.5" /> Vista mockup</>
                            : <><Database className="h-3.5 w-3.5" /> Vista real</>
                        }
                    </button>

                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen((v) => !v)}
                            className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-gray-100"
                        >
                            <div className="h-9 w-9 rounded-lg bg-[#1DBF73]/15 text-[#1DBF73] flex items-center justify-center text-sm font-bold tracking-wide">
                                {initials}
                            </div>
                            <div className="text-left">
                                <span className="block text-sm font-semibold text-[#3E4C59] max-w-40 truncate">{displayName}</span>
                                {user?.role && <span className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400">{user.role}</span>}
                            </div>
                            <ChevronDown className={`h-4 w-4 text-gray-400 ml-1 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-100 bg-white py-2 shadow-lg">
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Cerrar sesión
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </header>
    )
}

export default Topbar
