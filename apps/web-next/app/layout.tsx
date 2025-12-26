import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Cloud Deployer',
    description: 'Self-Service Cloud Deployment Platform',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className="antialiased">{children}</body>
        </html>
    )
}
