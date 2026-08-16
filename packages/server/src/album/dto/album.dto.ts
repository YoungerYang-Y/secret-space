import { IsInt, IsOptional, IsString, IsIn, IsArray, ValidateNested, ArrayMaxSize, IsNotEmpty, Matches, IsEmpty, IsDefined, Min, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator'
import { Type } from 'class-transformer'

function IsStringOrNull(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStringOrNull',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (!Array.isArray(value)) return false
          return value.every((item) => item === null || typeof item === 'string')
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} 中的每项必须是字符串或 null`
        },
      },
    })
  }
}

export class CreateAlbumDto {
  @IsInt()
  year: number

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  coverUploadReceipt?: string

  @IsOptional()
  @IsEmpty({ message: 'coverRef 已废弃，请使用 coverUploadReceipt' })
  coverRef?: never
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
  coverUploadReceipt?: string

  @IsOptional()
  @IsEmpty({ message: 'coverRef 已废弃，请使用 coverUploadReceipt' })
  coverRef?: never
}

export const VALID_TEMPLATES = ['single', 'double-h', 'double-v', 'triple', 'photo-text'] as const
// 与 admin 端 PageEditor.vue 的 TEMPLATES 保持一致；模板定义的统一由 DR-006 收口。
export const TEMPLATE_CONSTRAINTS = {
  single: { imageCount: 1, textRequired: false },
  'double-h': { imageCount: 2, textRequired: false },
  'double-v': { imageCount: 2, textRequired: false },
  triple: { imageCount: 3, textRequired: false },
  'photo-text': { imageCount: 1, textRequired: true },
} as const

export class PageContentDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsStringOrNull()
  @IsOptional()
  imageReceipts?: Array<string | null>

  @IsOptional()
  @IsEmpty({ message: 'images 已废弃，请使用 imageReceipts' })
  images?: never

  @IsOptional()
  @IsString()
  text?: string
}

export class CreatePageDto {
  @IsIn(VALID_TEMPLATES)
  templateId: string

  @IsDefined()
  @ValidateNested()
  @Type(() => PageContentDto)
  content: PageContentDto

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number
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
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: '文件名包含非法字符' })
  filename: string

  @IsString()
  @IsNotEmpty()
  contentType: string
}
