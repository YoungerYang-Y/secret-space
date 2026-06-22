import { IsString, IsNotEmpty } from 'class-validator'

export class VerifyDto {
  @IsString()
  @IsNotEmpty()
  password: string
}
