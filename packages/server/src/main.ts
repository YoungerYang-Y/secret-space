import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { loadStorageConfig } from './config/storage-config'
import { configureCors } from './config/configure-cors'

async function bootstrap() {
  const storageConfig = loadStorageConfig(process.env)

  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api', { exclude: ['health'] })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  app.use(cookieParser())
  configureCors(app, storageConfig)
  await app.listen(3000)
}
bootstrap()
