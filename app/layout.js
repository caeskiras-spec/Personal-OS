import './globals.css'
import { AuthProvider } from '../lib/auth'
import { OSProvider } from '../lib/store'

export const metadata = {
  title: 'PERSONAL OS',
  description: 'Операционная система для управления жизнью',
  icons: {
    icon:     '/icon.svg',
    shortcut: '/icon.svg',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>
          <OSProvider>
            {children}
          </OSProvider>
        </AuthProvider>
      </body>
    </html>
  )
}