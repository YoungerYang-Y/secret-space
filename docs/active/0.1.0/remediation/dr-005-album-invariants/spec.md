# DR-005 相册业务不变量 Spec

## 问题

当前相册模块缺少关键业务不变量校验：
- 模板与图片数量不匹配时仍可保存
- `photo-text` 模板可无文字
- 页面顺序可重复或跳跃
- 无并发冲突保护

## 目标

服务端强制校验相册业务规则，拒绝非法状态，异常与并发路径有测试覆盖。

---

## Behavior 1: 模板图片数量约束

### Scenario 1.1: single 模板必须恰好 1 张图片
- Given: 管理员创建/更新页面，templateId = `single`
- When: imageReceipts 数量 ≠ 1（0 张或 > 1 张）
- Then: 返回 400，message 包含 "single 模板需要 1 张图片"

### Scenario 1.2: double-h 模板必须恰好 2 张图片
- Given: 管理员创建/更新页面，templateId = `double-h`
- When: imageReceipts 数量 ≠ 2
- Then: 返回 400，message 包含 "double-h 模板需要 2 张图片"

### Scenario 1.3: double-v 模板必须恰好 2 张图片
- Given: 管理员创建/更新页面，templateId = `double-v`
- When: imageReceipts 数量 ≠ 2
- Then: 返回 400，message 包含 "double-v 模板需要 2 张图片"

### Scenario 1.4: triple 模板必须恰好 3 张图片
- Given: 管理员创建/更新页面，templateId = `triple`
- When: imageReceipts 数量 ≠ 3
- Then: 返回 400，message 包含 "triple 模板需要 3 张图片"

### Scenario 1.5: photo-text 模板必须恰好 1 张图片
- Given: 管理员创建/更新页面，templateId = `photo-text`
- When: imageReceipts 数量 ≠ 1
- Then: 返回 400，message 包含 "photo-text 模板需要 1 张图片"

### Scenario 1.6: 符合模板要求的图片数量通过校验
- Given: 管理员创建页面，templateId = `triple`，imageReceipts 恰好 3 项
- When: 提交请求
- Then: 返回 201，页面创建成功

### Scenario 1.7: 创建时图片不能为空
- Given: 管理员创建页面，templateId = `single`
- When: imageReceipts = [null] 或 imageReceipts = [""]
- Then: 返回 400，message 包含 "创建页面时图片不能为空"

### Scenario 1.8: 更新时修改模板必须提供图片
- Given: 管理员更新页面，现有 templateId = `single`
- When: 只传 templateId = `double-h`，不传 content
- Then: 返回 400，message 包含 "修改模板时必须提供图片"

### Scenario 1.9: 更新时图片数量需匹配新模板
- Given: 管理员更新页面，现有 templateId = `single`
- When: templateId = `double-h`，imageReceipts 只有 1 项
- Then: 返回 400，message 包含 "double-h 模板需要 2 张图片"

### Scenario 1.10: 更新时只传 content 不改 templateId
- Given: 管理员更新页面，现有 templateId = `double-h`（2 张图）
- When: 只传 content.imageReceipts = [newReceipt, null]（保留第二张）
- Then: 返回 200，第一张替换，第二张保留

### Scenario 1.11: 更新时 null 保留原图但原图不存在
- Given: 管理员更新页面，现有图片 = ["img1.webp", ""]（第二槽位为空）
- When: content.imageReceipts = [null, null]（尝试保留两张）
- Then: 返回 400，message 包含 "原图不存在，无法保留"

---

## Behavior 2: photo-text 模板文字必填

### Scenario 2.1: photo-text 模板缺少 text 字段
- Given: 管理员创建/更新页面，templateId = `photo-text`
- When: content.text 为空或未提供
- Then: 返回 400，message 包含 "photo-text 模板需要填写文字"

### Scenario 2.2: photo-text 模板 text 仅空白
- Given: 管理员创建页面，templateId = `photo-text`，text = "   "
- When: 提交请求
- Then: 返回 400，message 包含 "photo-text 模板需要填写文字"

### Scenario 2.3: photo-text 模板 text 有效
- Given: 管理员创建页面，templateId = `photo-text`，text = "有意义的文字"
- When: 提交请求
- Then: 返回 201，页面创建成功

### Scenario 2.4: 非 photo-text 模板 text 可选
- Given: 管理员创建页面，templateId = `single`
- When: content.text 未提供
- Then: 返回 201，页面创建成功（text 可选）

### Scenario 2.5: photo-text 只更新 text 不传 imageReceipts
- Given: 管理员更新 photo-text 页面，现有图片有效
- When: 只传 content.text = "新文字"，不传 imageReceipts
- Then: 返回 200，文字更新，图片保留

---

## Behavior 3: 页面顺序不变量

### Scenario 3.1: 新建页面 order 自动分配
- Given: 相册已有 2 个页面（order 1, 2）
- When: 管理员创建新页面，不指定 order
- Then: 新页面 order = 3（自动递增）

### Scenario 3.2: reorder 必须包含全部页面 ID
- Given: 相册有 3 个页面 [A, B, C]
- When: reorder 只传 [A, B]
- Then: 返回 400，message 包含 "pageIds count does not match"

### Scenario 3.3: reorder 不能包含不属于该相册的页面
- Given: 相册 X 有页面 [A, B]，相册 Y 有页面 [C]
- When: reorder X 传 [A, C]
- Then: 返回 400，message 包含 "pageIds contain IDs not belonging to this album"

### Scenario 3.4: reorder 后 order 连续
- Given: 相册有 3 个页面
- When: reorder 传 [C, A, B]
- Then: 页面 order 变为 C=1, A=2, B=3

---

## Behavior 4: 并发安全

### Scenario 4.1: 并发创建相同年份相册
- Given: 两个管理员同时创建 2024 年相册
- When: 并发提交
- Then: 一个成功 201，另一个失败 409（年份冲突）

### Scenario 4.2: 并发删除同一相册
- Given: 两个管理员同时删除相册 X
- When: 并发提交
- Then: 一个成功 204，另一个失败 404（已删除）

### Scenario 4.3: 并发 reorder 同一相册
- Given: 两个管理员同时 reorder 相册 X 的页面
- When: 并发提交
- Then: 两个请求串行执行，最终状态一致（最后提交的生效）

---

## 非功能约束

- 校验逻辑在服务端实现，不依赖前端
- 错误消息明确指出违反的规则
- 现有测试不因新增校验而失败（需同步更新测试数据）

## 范围外

- **媒体归属校验**：当前 uploadReceipt 按 scope（album/photo）分类，但不校验是否属于特定相册。由于回执是一次性、短期有效、仅管理员可获取，跨相册使用风险可控。如需严格归属校验，可另立条目。
