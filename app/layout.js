import './globals.css'
import { AuthProvider } from '../lib/auth'
import { OSProvider } from '../lib/store'
import ThemeProvider from './components/ThemeProvider'

export const metadata = {
  title: 'PERSONAL OS',
  description: 'Операционная система для управления жизнью',
  icons: {
    icon:     '/icon.svg',
    shortcut: '/icon.svg',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Anti-FOUC: runs synchronously before paint, reads localStorage → sets data-theme
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';if(t==='system'){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`

export default function RootLayout({ children }) {
  return (
    <html lang="ru" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>
          <OSProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </OSProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
