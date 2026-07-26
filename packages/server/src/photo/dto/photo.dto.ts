import { IsString, IsNotEmpty, IsInt, IsOptional, IsArray, Matches, IsEmpty } from 'class-validator'

export class PresignDto {
  @IsString()
  @IsNotEmpty()
  provinceCode: string

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_\-\.]+$/, { message: '文件名包含非法字符' })
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
  uploadReceipt: string

  @IsOptional()
  @IsEmpty({ message: 'mediaRef 已废弃，请使用 uploadReceipt' })
  mediaRef?: never

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
