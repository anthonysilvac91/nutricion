"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Activity } from "lucide-react"

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const email = (e.target as any).email.value
            const password = (e.target as any).password.value
            // We pass both but api.login mock only checks email existence for demo
            const { token } = await api.login(email, password)

            localStorage.setItem("token", token)
            router.push("/dashboard")
        } catch (err) {
            alert("Error al ingresar")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 -z-10 bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e87720_100%)]"></div>

            <Card className="w-full max-w-md shadow-xl border-none ring-1 ring-gray-900/5">
                <CardHeader className="text-center space-y-4 pb-6">
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
                        <Activity className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-800">NutriApp</CardTitle>
                    <p className="text-sm text-muted-foreground">Ingresa a tu cuenta profesional</p>
                </CardHeader>
                <CardContent className="pt-0 pb-8 px-8">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="nombre@ejemplo.com" required defaultValue="demo@nutriapp.com" className="h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input id="password" name="password" type="password" required defaultValue="password" className="h-11" />
                        </div>
                        <Button type="submit" className="w-full h-11 text-base font-semibold mt-4 shadow-lg shadow-primary/20" disabled={loading}>
                            {loading ? "Ingresando..." : "Ingresar"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
            <div className="absolute bottom-4 text-center text-xs text-muted-foreground">
                © 2025 NutriApp Inc.
            </div>
        </div>
    )
}
