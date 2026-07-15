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
}

main().catch((error) => {
  console.error('Fatal startup error:', error)
  process.exit(1)
})
