import './globals.css'

export const metadata = {
  title: 'Remarket AI - Universal AI Remarketing Platform',
  description: 'AI-powered remarketing that works for any business',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
