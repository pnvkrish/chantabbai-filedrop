import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard'],
    },
    sitemap: 'https://chantabbai-filedrop.vercel.app/sitemap.xml',
    host: 'https://chantabbai-filedrop.vercel.app',
  }
}
