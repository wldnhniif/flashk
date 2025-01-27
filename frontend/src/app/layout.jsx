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
    <html lang="id" className="scroll-smooth">
      <body className={`${inter.className} antialiased bg-gray-50`}>
        <AuthProvider>
          <main className="min-h-screen">
            {children}
          </main>
          <Toaster 
            position="top-right"
            toastOptions={{
              className: 'shadow-lg',
              duration: 3000,
              style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10B981',
                },
                iconTheme: {
                  primary: 'white',
                  secondary: '#10B981',
                },
              },
              error: {
                style: {
                  background: '#EF4444',
                },
                iconTheme: {
                  primary: 'white',
                  secondary: '#EF4444',
                },
              },
            }}
          />
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  )
} 