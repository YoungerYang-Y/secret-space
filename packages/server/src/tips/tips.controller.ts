import { Controller, Get } from '@nestjs/common'
import { TipsService } from './tips.service'

@Controller('tips')
export class TipsController {
  constructor(private tipsService: TipsService) {}

  @Get('random')
  getRandom() {
    return this.tipsService.findRandom()
  }
}
