# P2 相册 Brainstorm

## 设计共识

### 1. 数据模型与 API

**Album 模型：**
- id, year (unique), title (可选，默认"{}年的回忆"), coverUrl (封面图), createdAt
- 一个 Album 对应多个 Page

**Page 模型：**
- id, albumId, order (页序), templateId (预设模板标识), content (JSON，存放图片 URL 数组 + 文字内容), createdAt

**预设模板 ID（初期 5 种）：**
1. `single` — 单图满页
2. `double-h` — 左右双图
3. `double-v` — 上下双图
4. `triple` — 三宫格
5. `photo-text` — 上图下文

**API 端点：**
- `GET /albums` — 公开，返回所有相册（year, title, coverUrl, pageCount）
- `GET /albums/:id/pages` — 公开，返回某相册所有页面
- `POST /albums` — admin，创建相册
- `PUT /albums/:id` — admin，编辑相册信息
- `DELETE /albums/:id` — admin，删除相册（级联删除 pages）
- `POST /albums/:id/pages` — admin，新增页面
- `PUT /pages/:id` — admin，编辑页面（模板+内容）
- `PUT /albums/:id/pages/reorder` — admin，调整页面顺序
- `DELETE /pages/:id` — admin，删除页面
- 照片上传复用已有的 `POST /photos/presign`

### 2. 书架交互

**进入书架：**
- 用户在全景点击书架热区 → Camera zoom-in 到书架区域（复用 CameraController）
- zoom-in 完成后，书架 DOM overlay 显示（类似 MapOverlay 模式）

**书脊渲染：**
- 书脊容器用 CSS flexbox 横排排列，每本书是一个竖条 div
- 书脊宽度 40-50px，高度占满书架格子高度
- 书脊上竖排显示年份文字（writing-mode: vertical-rl）
- 每本书脊颜色根据 year hash 从预设色板中取
- 按年份升序从左到右排列

**hover 抽出动画：**
- hover 时书脊向上位移 15px + 顶部露出阴影（GSAP, duration: 0.3s, ease: power2.out）
- 光标变为可点击手型
- 移动端无 hover，直接点击即进入

**点击 → 打开翻页视图：**
- 点击书脊后，书架 overlay 隐藏
- 全屏翻页组件（AlbumViewer）以过渡动画展开
- 翻页组件有关闭按钮，关闭后返回书架 overlay

**空状态：**
- 无相册时书架显示"还没有相册哦～"

### 3. 翻页相册视图

**StPageFlip 集成：**
- AlbumViewer 组件全屏覆盖（z-index 高于所有层）
- StPageFlip 实例化，设置为双页模式（PC横屏）/ 单页模式（移动端竖屏）
- 页面尺寸自适应视口（保持 3:4 比例）

**页面渲染：**
- 每个 Page 根据 templateId 渲染对应布局模板
- 模板组件接收 content JSON，按模板规则放置图片和文字
- 图片懒加载（当前页±2页预加载，其余用占位）
- 文字支持简单样式（居中、字号）

**翻页交互：**
- PC：点击页面左/右半区域翻页，或键盘←→
- 移动端：左右滑动手势翻页
- 翻页时播放翻页音效（复用 AudioManager.playSfx）
- 底部显示页码指示器（当前页/总页数）

**封面与封底：**
- 第一页固定为封面（展示 year + title + coverUrl）
- 最后一页固定为封底（简单装饰或空白）

**关闭：**
- 右上角关闭按钮 / ESC 键
- 关闭动画后恢复书架 overlay

### 4. 管理后台扩展

**相册管理页（/albums）：**
- 表格展示所有相册：年份、标题、封面缩略图、页数、操作
- 新建相册：弹窗输入年份+标题+上传封面
- 编辑/删除相册

**页面编辑页（/albums/:id/pages）：**
- 左侧：页面列表（缩略卡片），可拖拽排序（vuedraggable）
- 右侧：当前选中页面的编辑区
  - 选择模板（5 种模板缩略图可选）
  - 根据模板显示对应的图片上传槽位 + 文字输入框
  - 图片上传复用 presign 直传 R2 流程
- 新增页面按钮（选模板 → 填内容 → 保存）
- 删除页面

**预览：**
- 编辑页有"预览"按钮，弹出翻页预览（复用 AlbumViewer 组件）

### 5. 技术决策

- **相册组织**：按年份，一年一本
- **页面布局**：预设模板（5 种），管理员选模板后填充内容
- **书架交互**：DOM overlay 模式，CSS 书脊 + GSAP hover 动画
- **翻页库**：StPageFlip (st-page-flip)
- **底图策略**：先用占位图开发，美术资源到位后替换
- **图片上传**：复用已有 R2 presign 基础设施

---

## 需求摘要（sdd-ready）

### 目标
实现按年份组织的相册系统：书架浏览 → 抽书翻页 → 照片回忆。

### 用户故事
- As a 访客/果果, I want 在书架上看到按年份排列的相册书脊, so that 我知道有哪些年的照片可以看
- As a 访客/果果, I want hover 书脊时看到抽出动画并点击打开相册, so that 交互有趣味感
- As a 访客/果果, I want 翻页浏览相册中的照片和文字, so that 像翻真实相册一样回忆过去
- As a 管理员, I want 创建年份相册并按模板编辑每一页的内容, so that 我能方便地整理照片
- As a 管理员, I want 拖拽调整页面顺序和预览效果, so that 相册排版符合我的预期

### 验收标准
- [ ] AC1: 书架区域 zoom-in 后显示书脊列表，按年份升序排列
- [ ] AC2: PC 端 hover 书脊时向上位移 15px 并显示阴影，动画流畅无卡顿
- [ ] AC3: 点击书脊后全屏打开 StPageFlip 翻页视图，支持滑动/点击翻页
- [ ] AC4: 翻页视图 PC 双页模式、移动端单页模式，页面比例 3:4
- [ ] AC5: 5 种预设模板（single/double-h/double-v/triple/photo-text）正确渲染对应布局
- [ ] AC6: 图片懒加载，仅当前页±2页预加载
- [ ] AC7: 翻页时播放翻页音效
- [ ] AC8: 管理后台可 CRUD 相册和页面，页面可拖拽排序
- [ ] AC9: 管理后台选择模板后显示对应的上传槽位和文字输入框
- [ ] AC10: 管理后台预览按钮可打开翻页预览
- [ ] AC11: 无相册时书架显示空状态提示

### 非功能需求
- 翻页动画帧率 ≥ 30fps
- 相册页面首屏渲染 ≤ 1 秒（当前页±2页图片可见）
- 支持浏览器：Chrome 90+、Safari 15+、Firefox 90+

### 已确认的技术决策
- 按年份组织相册（year unique）
- 预设布局模板（5 种），content 以 JSON 存储
- DOM overlay 模式渲染书架（复用 P1 MapOverlay 模式）
- StPageFlip 作为翻页库
- 先用占位图开发，底图后期替换
- 复用已有 R2 presign 上传流程

### 不做的事（Scope Out）
- 自由拖拽排版编辑器
- 书架底图美术制作
- 视频内容嵌入
- PixiJS 内渲染书架（用 DOM overlay 代替）
- 相册分享/导出功能

### 下一步
→ 使用 sdd skill 将本摘要正式化为 spec.md / design.md / plan.md

## Decisions

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| content JSON 结构 | A) 扁平数组 / B) 插槽命名 / C) 混合 | A | 模板槽位固定且少，数组下标映射够用，管理后台 UI 最简单 |
| 双页/单页切换时机 | A) 视口宽度阈值 / B) 设备类型固定 / C) 宽高比 | A | 768px 阈值直觉，与 CameraController 逻辑一致，resize 时重建实例 |
| 书脊颜色策略 | A) year hash / B) 存储 color 字段 / C) 随机+持久化 | A | 纯装饰性，不值得增加管理操作，预设色板保证视觉和谐 |
| 封面图来源 | A) 管理员单独上传 / B) 取首页首图 / C) 可选 fallback | A | 给管理员主动选择年度代表照片的能力，实现最简单 |
| 相册删除 R2 清理 | A) 同步删除 / B) 定期清理 / C) 软删除 | A | 低频操作，同步遍历删除简单直接，无需引入定时任务 |
| 图片尺寸策略 | A) 原图直出 / B) 上传时压缩 / C) 多尺寸 srcset | B | 1200px WebP 兼顾清晰度和加载速度，前端 canvas 压缩零后端改动 |
| 压缩在哪层做 | A) 前端压缩 / B) Cloudflare Transformations / C) 后端 sharp | A | 管理后台是唯一上传入口，canvas.toBlob 几行代码搞定 |
