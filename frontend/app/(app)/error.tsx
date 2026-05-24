"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { console.error(error) }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <div className="h-14 w-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Algo salió mal</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
                Ocurrió un error inesperado al cargar esta página.
            </p>
            <button
                onClick={reset}
                className="bg-[#1DBF73] hover:bg-[#15965A] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
                Reintentar
            </button>
        </div>
    )
}
