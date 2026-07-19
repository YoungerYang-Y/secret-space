import { IsString, IsNotEmpty } from 'class-validator'

export class ConfirmMediaDto {
  @IsString()
  @IsNotEmpty()
  key: string
}
