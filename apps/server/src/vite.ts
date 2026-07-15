import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Server } from 'node:http'
import express, { type Express } from 'express'

/**
 * Single-port web serving so the app maps cleanly to one Replit external port.
 * Dev: Vite in middleware mode (HMR) + SPA fallback that runs transformIndexHtml.
 * Prod: static files from the client build + SPA fallback. The API + /healthz
 * routes are registered before this, so they always take precedence.
 */
export async function setupWeb(app: Express, httpServer: Server): Promise<void> {
  const webRoot = path.resolve(process.cwd(), 'apps/web')

  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(webRoot, 'dist')
    app.use(express.static(clientDist))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
    return
  }

  const { createServer } = await import('vite')
  const vite = await createServer({
    root: webRoot,
    // allowedHosts: true is required so Vite's host-check (5.4.12+) does not 403
    // requests coming through the Replit *.replit.dev / *.replit.app proxy.
    server: { middlewareMode: true, allowedHosts: true, hmr: { server: httpServer } },
    appType: 'custom',
  })
  app.use(vite.middlewares)

  app.use('*', async (req, res, next) => {
    try {
      const template = await readFile(path.join(webRoot, 'index.html'), 'utf-8')
      const html = await vite.transformIndexHtml(req.originalUrl, template)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (error) {
      vite.ssrFixStacktrace(error as Error)
      next(error)
    }
  })
}
