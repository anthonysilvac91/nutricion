"use client"
import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Card, CardContent } from "@/components/ui/Card"
import { PageHeader } from "@/components/PageHeader"

const schema = z.object({
    date: z.string().min(1, "Fecha requerida"),
    weight: z.string().refine((val) => !isNaN(parseFloat(val)), "Debe ser número").transform(val => parseFloat(val)),
    height: z.string().refine((val) => !isNaN(parseFloat(val)), "Debe ser número").transform(val => parseFloat(val)),
})

export default function NewMeasurementPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0]
        }
    })

    const onSubmit = async (data: any) => {
        setLoading(true)
        try {
            await api.createMeasurement(id, data)
            router.push(`/patients/${id}?tab=measurements`)
        } catch (error) {
            console.error(error)
            alert("Error al guardar medición")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-xl mx-auto">
            <PageHeader title="Nueva Medición" subtitle="Registra el progreso del paciente" />

            <Card className="border-none shadow-md">
                <CardContent className="p-6">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="date">Fecha de Medición</Label>
                            <Input id="date" type="date" {...register("date")} />
                            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message as string}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="weight">Peso (kg)</Label>
                                <Input id="weight" type="number" step="0.1" {...register("weight")} placeholder="0.0" />
                                {errors.weight && <p className="text-red-500 text-xs mt-1">{errors.weight.message as string}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="height">Talla (cm)</Label>
                                <Input id="height" type="number" step="1" {...register("height")} placeholder="0" />
                                {errors.height && <p className="text-red-500 text-xs mt-1">{errors.height.message as string}</p>}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
                            <Button type="submit" disabled={loading} className="px-8 shadow-md shadow-primary/20">
                                {loading ? "Guardando..." : "Guardar y ver resultados"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
