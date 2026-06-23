import { IsString, IsNotEmpty, IsInt, IsOptional, IsArray, IsUrl } from 'class-validator'

export class PresignDto {
  @IsString()
  @IsNotEmpty()
  provinceCode: string

  @IsString()
  @IsNotEmpty()
  filename: string

  @IsString()
  @IsNotEmpty()
  contentType: string
}

export class CreatePhotoDto {
  @IsString()
  @IsNotEmpty()
  provinceCode: string

  @IsString()
  @IsNotEmpty()
  url: string

  @IsString()
  @IsNotEmpty()
  key: string

  @IsString()
  @IsOptional()
  annotation?: string

  @IsInt()
  order: number
}

export class ReorderDto {
  @IsString()
  @IsNotEmpty()
  provinceCode: string

  @IsArray()
  @IsInt({ each: true })
  photoIds: number[]
}

export class UpdatePhotoDto {
  @IsString()
  @IsOptional()
  annotation?: string
}
