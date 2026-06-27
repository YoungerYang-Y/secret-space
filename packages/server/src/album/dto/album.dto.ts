import { IsInt, IsOptional, IsString, IsIn, IsArray, IsUrl, ValidateNested, ArrayMaxSize, IsNotEmpty, Matches } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateAlbumDto {
  @IsInt()
  year: number

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsUrl({ require_tld: false })
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
  @IsUrl({ require_tld: false })
  coverUrl?: string
}

export const VALID_TEMPLATES = ['single', 'double-h', 'double-v', 'triple', 'photo-text'] as const

export class PageContentDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  images: string[]

  @IsOptional()
  @IsString()
  text?: string
}

export class CreatePageDto {
  @IsIn(VALID_TEMPLATES)
  templateId: string

  @ValidateNested()
  @Type(() => PageContentDto)
  content: PageContentDto

  @IsInt()
  order: number
}

export class UpdatePageDto {
  @IsOptional()
  @IsIn(VALID_TEMPLATES)
  templateId?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => PageContentDto)
  content?: PageContentDto
}

export class ReorderPagesDto {
  @IsArray()
  @IsString({ each: true })
  pageIds: string[]
}

export class AlbumPresignDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_\-\.]+$/, { message: '文件名包含非法字符' })
  filename: string

  @IsString()
  @IsNotEmpty()
  contentType: string
}
