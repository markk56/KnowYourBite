import { createServer } from 'node:http'
import { getEnv } from './config/env'
import { createApp } from './app'
import { setupWeb } from './vite'
import { errorHandler } from './middleware/error'
import { createSessionMiddleware } from './auth/session'
import './auth/passport' // register the local strategy

async function main(): Promise<void> {
  const env = getEnv()
  const sessionMiddleware = createSessionMiddleware()
  const app = createApp({ sessionMiddleware })
  const httpServer = createServer(app)

  await setupWeb(app, httpServer)
  app.use(errorHandler) // must be last

  httpServer.listen(env.PORT, () => {
    console.log(`Know Your Bite listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
  })

  // Release port 5000 immediately when the process is recycled. `tsx watch` (dev)
  // and Replit send SIGTERM to restart; without an explicit exit the open HTTP
  // listener + Neon pool + Vite HMR socket keep the process alive, so the old
  // instance lingers on the port, tsx reports "Previous process hasn't exited
  // yet. Force killing…", and the server flaps start → kill → restart. Dropping
  // keep-alive/HMR sockets lets close() resolve at once; the timer is a safety net.
  const shutdown = (signal: NodeJS.Signals): void => {
    console.log(`${signal} received — closing server…`)
    httpServer.closeAllConnections?.()
    httpServer.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 1500).unref()
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}

main().catch((error) => {
  console.error('Fatal startup error:', error)
  process.exit(1)
})
