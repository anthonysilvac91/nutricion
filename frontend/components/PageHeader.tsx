import * as React from "react"

interface PageHeaderProps {
    title: string
    subtitle?: string
    children?: React.ReactNode
}

export const PageHeader = ({ title, subtitle, children }: PageHeaderProps) => {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
                {children}
            </div>
        </div>
    )
}
