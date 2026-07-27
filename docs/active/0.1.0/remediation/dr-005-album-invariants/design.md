# DR-005 相册业务不变量 Design

## 设计决策

### D1: 模板约束定义

将模板图片数量和文字要求定义为常量映射：

```typescript
// album.dto.ts
export const TEMPLATE_CONSTRAINTS: Record<string, { imageCount: number; textRequired: boolean }> = {
  'single': { imageCount: 1, textRequired: false },
  'double-h': { imageCount: 2, textRequired: false },
  'double-v': { imageCount: 2, textRequired: false },
  'triple': { imageCount: 3, textRequired: false },
  'photo-text': { imageCount: 1, textRequired: true },
}
```

### D2: 校验时机

校验在 `AlbumService.createPage` 和 `AlbumService.updatePage` 中执行，位于事务开始前：
- 先校验模板约束，再执行业务逻辑
- 校验失败直接抛 `BadRequestException`，不进入事务

### D3: 图片数量计算

**创建时**：
- imageReceipts 数组长度必须等于模板要求的 imageCount
- 数组中每项必须是有效 receipt（不允许空字符串或 null）

**更新时**：
- 如果传了 content.imageReceipts，长度必须等于模板要求的 imageCount
- `null` 表示保留原位置图片
- 空字符串 `""` 不允许（不能清空某个槽位，只能替换）
- 如果不传 content，则不校验图片数量（只更新 templateId 是不允许的，见 D3a）

### D3a: templateId 变更约束

更新页面时如果修改 templateId：
- 必须同时提供 content.imageReceipts
- imageReceipts 长度必须符合新模板要求
- 这意味着不能"只改模板不改图片"

### D4: order 自动分配

修改 `CreatePageDto`，将 `order` 改为可选：
- 提供时使用指定值
- 未提供时自动分配 `max(existing orders) + 1`

### D5: 并发控制

SQLite 的事务隔离级别（SERIALIZABLE）已提供足够的并发保护：
- 年份冲突通过 unique 约束 + 事务保证
- 删除并发通过 `findUnique` + 事务保证
- reorder 并发通过事务串行化

无需额外乐观锁机制。

---

## 接口变更

### CreatePageDto

```typescript
export class CreatePageDto {
  @IsIn(VALID_TEMPLATES)
  templateId: string

  @IsDefined()
  @ValidateNested()
  @Type(() => PageContentDto)
  content: PageContentDto

  @IsOptional()  // 改为可选
  @IsInt()
  order?: number
}
```

### 错误响应

模板校验失败返回：
```json
{
  "statusCode": 400,
  "message": "single 模板需要 1 张图片，当前 0 张",
  "error": "Bad Request"
}
```

文字校验失败返回：
```json
{
  "statusCode": 400,
  "message": "photo-text 模板需要填写文字",
  "error": "Bad Request"
}
```

---

## 实现位置

### 新增

| 文件 | 说明 |
|------|------|
| `album.dto.ts` | 添加 `TEMPLATE_CONSTRAINTS` 常量 |

### 修改

| 文件 | 变更 |
|------|------|
| `album.dto.ts` | `CreatePageDto.order` 改为可选 |
| `album.service.ts` | 添加 `validatePageContent` 方法，在 `createPage`/`updatePage` 开头调用 |

---

## 校验逻辑伪代码

```typescript
// 创建页面时的校验
private validateCreatePage(templateId: string, content: PageContentDto) {
  const constraint = TEMPLATE_CONSTRAINTS[templateId]
  if (!constraint) throw new BadRequestException(`未知模板: ${templateId}`)

  const receipts = content.imageReceipts ?? []
  if (receipts.length !== constraint.imageCount) {
    throw new BadRequestException(
      `${templateId} 模板需要 ${constraint.imageCount} 张图片，当前 ${receipts.length} 张`
    )
  }

  // 创建时不允许 null 或空字符串
  if (receipts.some(r => r === null || r === '')) {
    throw new BadRequestException('创建页面时图片不能为空')
  }

  if (constraint.textRequired && (!content.text || !content.text.trim())) {
    throw new BadRequestException(`${templateId} 模板需要填写文字`)
  }
}

// 更新页面时的校验
private validateUpdatePage(
  newTemplateId: string | undefined,
  content: PageContentDto | undefined,
  existingTemplateId: string,
  existingImages: string[],  // 改为传入现有图片数组
) {
  const effectiveTemplateId = newTemplateId ?? existingTemplateId
  const constraint = TEMPLATE_CONSTRAINTS[effectiveTemplateId]
  if (!constraint) throw new BadRequestException(`未知模板: ${effectiveTemplateId}`)

  // 如果修改了 templateId，必须提供 imageReceipts
  if (newTemplateId && newTemplateId !== existingTemplateId && !content?.imageReceipts) {
    throw new BadRequestException('修改模板时必须提供图片')
  }

  // 如果提供了 imageReceipts，校验数量和有效性
  if (content?.imageReceipts) {
    if (content.imageReceipts.length !== constraint.imageCount) {
      throw new BadRequestException(
        `${effectiveTemplateId} 模板需要 ${constraint.imageCount} 张图片，当前 ${content.imageReceipts.length} 张`
      )
    }
    // 更新时允许 null（保留原图），但不允许空字符串
    for (let i = 0; i < content.imageReceipts.length; i++) {
      const receipt = content.imageReceipts[i]
      if (receipt === '') {
        throw new BadRequestException('图片不能为空字符串')
      }
      // null 表示保留原图，但原图必须存在
      if (receipt === null && (!existingImages[i] || existingImages[i] === '')) {
        throw new BadRequestException(`第 ${i + 1} 张原图不存在，无法保留`)
      }
    }
  }

  // 如果是 photo-text 模板，校验文字
  if (constraint.textRequired && content?.text !== undefined) {
    if (!content.text || !content.text.trim()) {
      throw new BadRequestException(`${effectiveTemplateId} 模板需要填写文字`)
    }
  }
}
```

---

## 测试策略

### 单元测试

在 `album.controller.test.ts` 中新增：
- 各模板图片数量校验（正向/负向）
- photo-text 文字必填校验
- order 自动分配

### 并发测试

在 `album.controller.test.ts` 中新增：
- 并发创建相同年份（使用 `Promise.allSettled`）
- 并发删除同一相册

### 现有测试修正

检查现有测试用例，确保传入的图片数量符合模板要求。

---

## 回归风险

| 风险 | 缓解 |
|------|------|
| 现有测试因新增校验失败 | 更新测试数据匹配模板要求 |
| Admin 前端创建页面失败 | 前端已按模板限制图片槽位，风险低 |
| 历史数据不符合新规则 | 新规则只校验写操作，读取不受影响 |
