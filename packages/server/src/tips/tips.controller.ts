import { Controller, Get, UseGuards } from '@nestjs/common'
import { TipsService } from './tips.service'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'

@Controller('tips')
@UseGuards(RolesGuard)
export class TipsController {
  constructor(private tipsService: TipsService) {}

  @Get('random')
  @Roles('visitor', 'owner', 'admin')
  getRandom() {
    return this.tipsService.findRandom()
  }
}
