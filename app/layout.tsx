import React from "react"
import type { Metadata, Viewport } from 'next'
import { Noto_Sans_SC, JetBrains_Mono } from 'next/font/google'

import './globals.css'

const _noto = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const _jetbrains = JetBrains_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '啄米',
  description: '啄米 - 精准捕捉每一个信号，积少成多。个股信号记录与可视化工具。',
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
