import Link from "next/link"
import { Sprout } from "lucide-react"

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#F3F6F8] flex items-center justify-center">
            <div className="text-center px-6">
                <div className="flex justify-center mb-4">
                    <div className="h-16 w-16 rounded-2xl bg-[#E6FFFA] text-[#1DBF73] flex items-center justify-center">
                        <Sprout className="h-8 w-8" />
                    </div>
                </div>
                <p className="text-5xl font-black text-[#1DBF73] mb-2">404</p>
                <h1 className="text-xl font-bold text-gray-800 mb-2">Página no encontrada</h1>
                <p className="text-sm text-gray-500 mb-6">La ruta que buscas no existe o fue movida.</p>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 bg-[#1DBF73] hover:bg-[#15965A] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
                >
                    Volver al inicio
                </Link>
            </div>
        </div>
    )
}
