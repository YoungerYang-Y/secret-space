import { IsInt, IsOptional, IsString, IsIn, IsArray, ValidateNested, IsObject } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateAlbumDto {
  @IsInt()
  year: number

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  coverUrl?: string
}

export class UpdateAlbumDto {
  @IsOptional()
  @IsInt()
  year?: number

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  coverUrl?: string
}

const VALID_TEMPLATES = ['single', 'double-h', 'double-v', 'triple', 'photo-text'] as const

export class CreatePageDto {
  @IsIn(VALID_TEMPLATES)
  templateId: string

  @IsObject()
  content: { images: string[]; text?: string }

  @IsInt()
  order: number
}

export class UpdatePageDto {
  @IsOptional()
  @IsIn(VALID_TEMPLATES)
  templateId?: string

  @IsOptional()
  @IsObject()
  content?: { images: string[]; text?: string }
}

export class ReorderPagesDto {
  @IsArray()
  @IsString({ each: true })
  pageIds: string[]
}
