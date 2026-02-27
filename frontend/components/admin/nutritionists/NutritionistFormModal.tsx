"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { nutritionistsService } from "@/services/nutritionistsService"

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function NutritionistFormModal({ isOpen, onClose, onSuccess }: Props) {
    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            await nutritionistsService.create({
                fullName,
                email,
                password: password || undefined
            })
            // Reset form
            setFullName("")
            setEmail("")
            setPassword("")

            onSuccess() // triggers refetch and toast externally
            onClose()
        } catch (err: any) {
            setError(err.message || "Error al crear nutricionista")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 set border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Crear Nutricionista</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="fullName">Nombre Completo <span className="text-red-500">*</span></Label>
                        <Input
                            id="fullName"
                            required
                            placeholder="Ej. Dr. Carlos Silva"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            placeholder="correo@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña temporal (opcional)</Label>
                        <Input
                            id="password"
                            type="text"
                            placeholder="Dejar vacío para generar automáticamente"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">MVP: Si se deja vacío, sugeriremos que revise su correo.</p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="min-w-[100px]" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
