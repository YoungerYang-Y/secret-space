import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { R2Service } from '../r2/r2.service'
import { CreateAlbumDto, UpdateAlbumDto, CreatePageDto, UpdatePageDto, ReorderPagesDto } from './dto/album.dto'

@Injectable()
export class AlbumService {
  constructor(
    private prisma: PrismaService,
    private r2: R2Service,
  ) {}

  findAll() {
    return this.prisma.album.findMany({ orderBy: { year: 'asc' } })
  }

  async findPages(albumId: string) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } })
    if (!album) throw new NotFoundException('Album not found')
    return this.prisma.page.findMany({ where: { albumId }, orderBy: { order: 'asc' } })
  }

  async create(dto: CreateAlbumDto) {
    const existing = await this.prisma.album.findUnique({ where: { year: dto.year } })
    if (existing) throw new ConflictException(`Album for year ${dto.year} already exists`)
    return this.prisma.album.create({ data: dto })
  }

  async update(id: string, dto: UpdateAlbumDto) {
    const album = await this.prisma.album.findUnique({ where: { id } })
    if (!album) throw new NotFoundException('Album not found')
    if (dto.year && dto.year !== album.year) {
      const conflict = await this.prisma.album.findUnique({ where: { year: dto.year } })
      if (conflict) throw new ConflictException(`Album for year ${dto.year} already exists`)
    }
    return this.prisma.album.update({ where: { id }, data: dto })
  }

  async delete(id: string) {
    const album = await this.prisma.album.findUnique({ where: { id }, include: { pages: true } })
    if (!album) throw new NotFoundException('Album not found')

    // Extract R2 keys from pages content + cover
    const keys: string[] = []
    for (const page of album.pages) {
      try {
        const content = JSON.parse(page.content)
        for (const url of content.images || []) {
          const key = this.extractKey(url)
          if (key) keys.push(key)
        }
      } catch {}
    }
    if (album.coverUrl) {
      const key = this.extractKey(album.coverUrl)
      if (key) keys.push(key)
    }

    await this.prisma.album.delete({ where: { id } })

    // Best-effort R2 cleanup — failures logged, not blocking
    for (const key of keys) {
      try {
        await this.r2.delete(key)
      } catch (e) {
        console.error(`R2 cleanup failed for key: ${key}`, e)
      }
    }
  }

  async createPage(albumId: string, dto: CreatePageDto) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } })
    if (!album) throw new NotFoundException('Album not found')
    return this.prisma.page.create({
      data: { albumId, templateId: dto.templateId, content: JSON.stringify(dto.content), order: dto.order },
    })
  }

  async updatePage(pageId: string, dto: UpdatePageDto) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } })
    if (!page) throw new NotFoundException('Page not found')
    const data: any = {}
    if (dto.templateId) data.templateId = dto.templateId
    if (dto.content) data.content = JSON.stringify(dto.content)
    return this.prisma.page.update({ where: { id: pageId }, data })
  }

  async deletePage(pageId: string) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } })
    if (!page) throw new NotFoundException('Page not found')
    await this.prisma.page.delete({ where: { id: pageId } })
  }

  async reorderPages(albumId: string, dto: ReorderPagesDto) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } })
    if (!album) throw new NotFoundException('Album not found')
    const pages = await this.prisma.page.findMany({ where: { albumId } })
    if (dto.pageIds.length !== pages.length) {
      throw new BadRequestException('pageIds count does not match actual page count')
    }
    const pageIdSet = new Set(pages.map((p) => p.id))
    if (!dto.pageIds.every((id) => pageIdSet.has(id))) {
      throw new BadRequestException('pageIds contain IDs not belonging to this album')
    }
    await this.prisma.$transaction(
      dto.pageIds.map((id, i) => this.prisma.page.update({ where: { id }, data: { order: i + 1 } })),
    )
  }

  private extractKey(url: string): string | null {
    try {
      const u = new URL(url)
      return u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
    } catch {
      return null
    }
  }
}
