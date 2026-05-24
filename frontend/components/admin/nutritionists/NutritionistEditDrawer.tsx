"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, Loader2, ShieldOff, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Nutritionist, nutritionistsService, SubscriptionStatus } from "@/services/nutritionistsService"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
    isOpen: boolean
    nutritionist: Nutritionist | null
    onClose: () => void
    onSuccess: () => void
}

const statusLabels: Record<SubscriptionStatus, string> = {
    TRIALING: "En prueba",
    ACTIVE: "Activo",
    EXPIRED: "Expirado",
    BLOCKED: "Bloqueado",
}

const statusOptions: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "EXPIRED", "BLOCKED"]

const formatDate = (value: string | null) => {
    if (!value) return "—"
    return format(new Date(value), "dd MMM yyyy HH:mm", { locale: es })
}

export function NutritionistEditDrawer({ isOpen, nutritionist, onClose, onSuccess }: Props) {
    const [status, setStatus] = useState<SubscriptionStatus>("TRIALING")
    const [extendTrialDays, setExtendTrialDays] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        if (nutritionist) {
            setStatus(nutritionist.subscriptionStatus)
            setExtendTrialDays("")
            setError("")
        }
    }, [nutritionist])

    if (!isOpen || !nutritionist) return null

    const handleSave = async () => {
        setIsLoading(true)
        setError("")

        try {
            const days = Number(extendTrialDays)
            await nutritionistsService.update(nutritionist.id, {
                subscriptionStatus: status,
                extendTrialDays: Number.isFinite(days) && days > 0 ? days : undefined,
            })
            onSuccess()
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al actualizar")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Administrar nutricionista</h2>
                        <p className="text-sm text-gray-500">{nutritionist.email}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 font-bold rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Resumen</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">Pacientes activos</p>
                                <p className="font-medium text-gray-900">{nutritionist.patientsCount}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Registro</p>
                                <p className="font-medium text-gray-900">{formatDate(nutritionist.createdAt)}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-gray-500">Fin de prueba</p>
                                <p className="font-medium text-gray-900">{formatDate(nutritionist.trialEndsAt)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>Estado de suscripción</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {statusOptions.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setStatus(option)}
                                    className={`py-2 px-3 rounded-md border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${status === option ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                                >
                                    {status === option && <CheckCircle2 className="h-4 w-4" />}
                                    {statusLabels[option]}
                                </button>
                            ))}
                        </div>
                        {status === "BLOCKED" && (
                            <p className="text-xs text-red-600 mt-1 flex gap-1.5">
                                <ShieldOff className="h-3.5 w-3.5" />
                                El usuario quedará bloqueado para lectura y escritura.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="extendTrialDays">Extender prueba</Label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                id="extendTrialDays"
                                type="number"
                                min={1}
                                placeholder="Días adicionales"
                                value={extendTrialDays}
                                onChange={(e) => setExtendTrialDays(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <p className="text-xs text-gray-500">Si se informa un valor, el backend ajustará `trialEndsAt` y dejará el estado en prueba salvo que esté bloqueado.</p>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1 bg-white">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading} className="flex-1">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
