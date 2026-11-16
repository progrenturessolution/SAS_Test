import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const poppins = Poppins({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Progrentures - Online Assessment Platform',
  description: 'Ace your exams with smart online testing. Take practice tests, mock exams, and skill assessments anytime, anywhere.',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} font-sans antialiased font-normal`}>
        <Toaster richColors position="top-right" />
        {children}
      </body>
    </html>
  )
}
