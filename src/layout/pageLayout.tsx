import React from 'react'

export function PageLayout({
  children,
  title,
  description,
}: {
  children: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div>
        <h1 className="text-foreground text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

export default PageLayout
