import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'KasirKuy',
  description: 'Aplikasi kasir sederhana untuk toko Anda',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="h-full">
      <body className={`${inter.className} min-h-full antialiased`}>
        <AuthProvider>
          <main className="flex flex-col min-h-screen">
            {children}
          </main>
          <Toaster position="top-right" />
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  )
} 