import './globals.css'

export const metadata = {
  title: 'Attrios - AI Visitor Intelligence & Remarketing',
  description: 'Turn anonymous visitors into revenue. AI-powered identification and remarketing that recovers lost sales.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
