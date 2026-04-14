import type { Metadata } from 'next'
import { Poppins, Inter } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
})

const BASE_URL = 'https://chantabbai-filedrop.vercel.app'

export const metadata: Metadata = {
  // ── Core ────────────────────────────────────────────────────────────────────
  title: {
    default: 'Chantabbai FileDrop — AI-Powered Bill & Expense Management',
    template: '%s | Chantabbai FileDrop',
  },
  description:
    'Chantabbai FileDrop is an AI-powered bill management system for restaurants and canteens. Upload bills, auto-extract vendor, amount & category using AI, and track monthly expenses with analytics.',
  keywords: [
    'Chantabbai FileDrop',
    'chantabbai file drop',
    'chantabbai',
    'bill management',
    'AI bill extraction',
    'expense tracker',
    'restaurant expense management',
    'invoice management',
    'AI invoice reader',
    'canteen expense tracker',
    'file upload system',
    'P N V Krishna',
  ],
  authors: [{ name: 'P N V Krishna' }],
  creator: 'P N V Krishna',
  publisher: 'Chantabbai',

  // ── Google Search Verification ───────────────────────────────────────────────
  verification: {
    google: 'google2436c32a76195fad',
  },

  // ── Canonical URL ────────────────────────────────────────────────────────────
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: '/',
  },

  // ── Open Graph (WhatsApp, Facebook, LinkedIn previews) ───────────────────────
  openGraph: {
    type: 'website',
    url: BASE_URL,
    siteName: 'Chantabbai FileDrop',
    title: 'Chantabbai FileDrop — AI-Powered Bill & Expense Management',
    description:
      'Upload bills, auto-extract vendor, amount & category using AI. Track monthly expenses with analytics for restaurants and canteens.',
    images: [
      {
        url: `${BASE_URL}/logo.png`,
        width: 512,
        height: 512,
        alt: 'Chantabbai FileDrop Logo',
      },
    ],
    locale: 'en_IN',
  },

  // ── Twitter / X card ────────────────────────────────────────────────────────
  twitter: {
    card: 'summary',
    title: 'Chantabbai FileDrop — AI-Powered Bill & Expense Management',
    description:
      'AI-powered bill management for restaurants. Upload bills, auto-extract data, track expenses.',
    images: [`${BASE_URL}/logo.png`],
  },

  // ── Robots ───────────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },

  // ── Icons ────────────────────────────────────────────────────────────────────
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export const viewport = {
  themeColor: '#C4161C',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Chantabbai FileDrop',
  url: 'https://chantabbai-filedrop.vercel.app',
  description:
    'AI-powered bill and expense management system for restaurants and canteens. Upload bills, auto-extract vendor details and amounts using AI, and track monthly expenses with analytics.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  author: {
    '@type': 'Person',
    name: 'P N V Krishna',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Chantabbai',
    logo: {
      '@type': 'ImageObject',
      url: 'https://chantabbai-filedrop.vercel.app/logo.png',
    },
  },
  keywords: 'bill management, expense tracker, AI invoice, restaurant expenses, chantabbai',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body style={{ fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
        {children}
        <div id="toast-container" className="toast-container" />
      </body>
    </html>
  )
}
