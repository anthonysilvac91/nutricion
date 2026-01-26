"use client"
import { usePathname } from "next/navigation"
import { Bell, Mail, Monitor, ChevronLeft, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/Button"

const Topbar = () => {
    const pathname = usePathname()

    // Determine title based on path
    const getPageTitle = (path: string) => {
        if (path.includes("/dashboard")) return "Dashboard"
        if (path.includes("/patients/new")) return "Agregar nuevo paciente"
        if (path.includes("/patients") && path.split("/").length === 2) return "Pacientes"
        if (path.includes("/patients") && path.split("/").length > 2) return "Perfil del paciente"
        return "NutriApp"
    }

    const title = getPageTitle(pathname)

    return (
        <header className="sticky top-0 z-40 h-[72px] bg-[#F3F6F8]/90 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-7xl mx-auto px-8 flex items-center justify-between h-full">

                {/* Title Area */}
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-[#3E4C59] tracking-tight">{title}</h1>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3">
                    {/* User Pill */}
                    <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-gray-100">
                        <div className="h-9 w-9 overflow-hidden rounded-lg border-2 border-white shadow-sm bg-blue-50">
                            <img src="https://ui-avatars.com/api/?name=Dr+Nutri&background=random" alt="Profile" />
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-[#3E4C59]">Dr. Nutricionista</span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-gray-400 ml-2" />
                    </div>
                </div>
            </div>
        </header>
    )
}

export default Topbar
