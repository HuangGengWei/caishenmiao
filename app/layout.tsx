import React from "react"
import type { Metadata, Viewport } from 'next'
import { Noto_Sans_SC, JetBrains_Mono } from 'next/font/google'

import './globals.css'

const _noto = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const _jetbrains = JetBrains_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '财神庙',
  description: '财神庙 - 板块分时信号记录与可视化',
}

export const viewport: Viewport = {
  themeColor: '#fcfcfc',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
