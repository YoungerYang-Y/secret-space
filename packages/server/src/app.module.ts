import { Module } from '@nestjs/common'
import { AlbumModule } from './album/album.module'
import { AuthModule } from './auth/auth.module'
import { HealthModule } from './health/health.module'
import { PhotoModule } from './photo/photo.module'
import { PrismaModule } from './prisma/prisma.module'
import { ProvinceModule } from './province/province.module'
import { TipsModule } from './tips/tips.module'

@Module({
  imports: [PrismaModule, HealthModule, TipsModule, AuthModule, ProvinceModule, PhotoModule, AlbumModule],
})
export class AppModule {}
