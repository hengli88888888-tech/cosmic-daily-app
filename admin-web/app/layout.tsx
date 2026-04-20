import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: {
    default: 'Oraya',
    template: '%s | Oraya',
  },
  description: 'Oraya guidance, support, and operations.',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
