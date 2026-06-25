# P2 相册

## Overview

为"秘密空间"提供年度相册功能。用户通过 3D 场景中的书架热区进入相册书架，浏览按年份排列的相册书脊，点击后进入全屏翻页阅读体验。管理员通过后台管理相册和页面内容。

数据模型：
- Album: id, year (unique), title (可选), coverUrl, createdAt
- Page: id, albumId, order, templateId, content (JSON: { images: [...], text?: string }), createdAt
- 模板类型: single, double-h, double-v, triple, photo-text

---

## Behavior: 书架浏览

### Scenario: 正常加载书架并展示相册书脊

Given 系统中存在 3 本相册（year: 2022, 2023, 2024）
When 用户点击全景中的书架热区
Then 相机 zoom-in 到书架位置
And 书架 overlay 显示 3 个书脊，按 year 升序横向排列
And 每个书脊宽度在 40-50px 之间，竖排显示年份文字
And 每个书脊颜色由对应 year 决定，来自预设色板

### Scenario: 书脊 hover 交互反馈

Given 书架 overlay 已显示且包含相册书脊
When 用户 hover 某个书脊
Then 该书脊向上位移 15px
And 显示阴影效果
And 动画时长为 0.3 秒

### Scenario: 点击书脊进入翻页视图

Given 书架 overlay 已显示且包含相册书脊
When 用户点击 year 为 2023 的书脊
Then 书架 overlay 隐藏
And 全屏翻页视图打开，展示 2023 相册内容

### Scenario: 空状态展示

Given 系统中不存在任何相册
When 用户点击全景中的书架热区
Then 相机 zoom-in 到书架位置
And 书架 overlay 显示空状态文案"还没有相册哦"

---

## Behavior: 翻页阅读

### Scenario: 桌面端双页模式正常阅读

Given 视口宽度为 1024px
And 相册包含封面页 + 4 个内容页 + 封底页
When 用户打开该相册的翻页视图
Then 以双页模式展示，页面比例为 3:4
And 第一展开页为封面页，显示 year、title 和 coverUrl 对应图片
And 最后一页为封底页

### Scenario: 移动端单页模式

Given 视口宽度为 375px
And 相册包含封面页 + 2 个内容页 + 封底页
When 用户打开该相册的翻页视图
Then 以单页模式展示，页面比例为 3:4

### Scenario: 翻页操作（桌面端）

Given 翻页视图已打开，当前展示第 1-2 页
When 用户点击右侧区域或按下右方向键
Then 翻到第 3-4 页
And 播放翻页音效

### Scenario: 翻页操作（移动端）

Given 翻页视图已打开，当前展示第 1 页
When 用户向左滑动
Then 翻到第 2 页
And 播放翻页音效

### Scenario: 图片懒加载策略

Given 相册共 10 页，当前展示第 5 页
When 翻页视图渲染时
Then 仅加载第 3-7 页（当前页 ±2）的图片资源
And 其余页面图片未加载

### Scenario: 关闭翻页视图

Given 翻页视图已全屏打开
When 用户点击右上角关闭按钮或按下 ESC 键
Then 翻页视图关闭
And 书架 overlay 重新显示

### Scenario: 模板渲染

Given 某页 templateId 为 "photo-text"，content 为 { images: ["url1.jpg"], text: "说明文字" }
When 翻页视图渲染该页
Then 页面显示 1 张图片和对应文字"说明文字"

---

## Behavior: 相册管理 API（CRUD）

### Scenario: 获取相册列表

Given 系统中存在 2 本相册（year: 2023, 2024）
When 发送 GET /albums
Then 响应状态码为 200
And 返回包含 2 个相册对象的数组，按 year 升序排列
And 每个对象包含 id, year, title, coverUrl, createdAt 字段

### Scenario: 创建相册成功

Given 用户已通过管理员认证
And 系统中不存在 year 为 2025 的相册
When 发送 POST /albums，body 为 { year: 2025, title: "二十五年", coverUrl: "https://r2.example/cover.jpg" }
Then 响应状态码为 201
And 返回新创建的相册对象，year 为 2025，title 为"二十五年"

### Scenario: 创建相册 year 重复

Given 用户已通过管理员认证
And 系统中已存在 year 为 2024 的相册
When 发送 POST /albums，body 为 { year: 2024, title: "重复" }
Then 响应状态码为 409
And 返回错误信息表明该年份已存在

### Scenario: 未认证用户创建相册

Given 用户未通过管理员认证
When 发送 POST /albums，body 为 { year: 2025 }
Then 响应状态码为 401

### Scenario: 更新相册

Given 用户已通过管理员认证
And 存在 id 为 "abc" 的相册，当前 title 为 "旧标题"
When 发送 PUT /albums/abc，body 为 { title: "新标题" }
Then 响应状态码为 200
And 返回的相册对象 title 为"新标题"

### Scenario: 更新相册 year 冲突

Given 用户已通过管理员认证
And 系统中存在 year 为 2023 和 2024 的相册
When 发送 PUT /albums/{2023的id}，body 为 { year: 2024 }
Then 响应状态码为 409
And 返回错误信息表明该年份已存在
And 原相册 year 仍为 2023

### Scenario: 删除相册级联清理

Given 用户已通过管理员认证
And 存在 id 为 "abc" 的相册，包含 3 个 page，page 中引用了 R2 文件
When 发送 DELETE /albums/abc
Then 响应状态码为 204
And 该相册的 3 个 page 记录被删除
And 关联的 R2 文件被同步删除
And 再次 GET /albums 不包含该相册

### Scenario: 删除不存在的相册

Given 用户已通过管理员认证
When 发送 DELETE /albums/nonexistent
Then 响应状态码为 404

---

## Behavior: 页面管理 API

### Scenario: 获取相册页面列表

Given 相册 "abc" 包含 3 个 page，order 分别为 1, 2, 3
When 发送 GET /albums/abc/pages
Then 响应状态码为 200
And 返回 3 个 page 对象，按 order 升序排列
And 每个对象包含 id, albumId, order, templateId, content, createdAt

### Scenario: 添加页面成功

Given 用户已通过管理员认证
And 相册 "abc" 当前有 2 个 page
When 发送 POST /albums/abc/pages，body 为 { templateId: "single", content: { images: ["url.jpg"] }, order: 3 }
Then 响应状态码为 201
And 返回新 page 对象，templateId 为 "single"，order 为 3

### Scenario: 添加页面使用无效模板

Given 用户已通过管理员认证
When 发送 POST /albums/abc/pages，body 为 { templateId: "invalid", content: { images: [] }, order: 1 }
Then 响应状态码为 400
And 返回错误信息表明 templateId 无效，有效值为 single, double-h, double-v, triple, photo-text

### Scenario: 向不存在的相册添加页面

Given 用户已通过管理员认证
And 系统中不存在 id 为 "nonexistent" 的相册
When 发送 POST /albums/nonexistent/pages，body 为 { templateId: "single", content: { images: ["url.jpg"] }, order: 1 }
Then 响应状态码为 404
And 返回错误信息表明相册不存在

### Scenario: 更新页面内容

Given 用户已通过管理员认证
And 存在 id 为 "p1" 的 page
When 发送 PUT /pages/p1，body 为 { templateId: "double-h", content: { images: ["a.jpg", "b.jpg"] } }
Then 响应状态码为 200
And 返回的 page 对象 templateId 为 "double-h"，content.images 长度为 2

### Scenario: 页面重新排序

Given 用户已通过管理员认证
And 相册 "abc" 有 3 个 page，id 分别为 p1(order:1), p2(order:2), p3(order:3)
When 发送 PUT /albums/abc/pages/reorder，body 为 { pageIds: ["p3", "p1", "p2"] }
Then 响应状态码为 200
And p3 的 order 为 1，p1 的 order 为 2，p2 的 order 为 3

### Scenario: 重排序传入不完整 pageIds

Given 用户已通过管理员认证
And 相册 "abc" 有 3 个 page
When 发送 PUT /albums/abc/pages/reorder，body 为 { pageIds: ["p1", "p2"] }
Then 响应状态码为 400
And 返回错误信息表明 pageIds 数量与实际页面数不匹配

### Scenario: 删除页面

Given 用户已通过管理员认证
And 存在 id 为 "p1" 的 page
When 发送 DELETE /pages/p1
Then 响应状态码为 204
And 该 page 不再存在

---

## Behavior: 管理后台交互

### Scenario: 相册列表 CRUD 操作

Given 管理员已登录后台
And 系统中存在 2 本相册
When 管理员进入相册管理页面
Then 显示 2 条相册记录，包含 year、title、操作按钮（编辑/删除）
And 提供新建相册按钮

### Scenario: 页面编辑拖拽排序

Given 管理员正在编辑相册，左侧页面列表有 3 个页面（order 1, 2, 3）
When 管理员将第 3 个页面拖拽到第 1 个位置
Then 左侧列表顺序更新为原第 3 页、第 1 页、第 2 页
And 自动调用重排序接口保存新顺序

### Scenario: 页面编辑选择模板并填写内容

Given 管理员正在编辑某个 page
When 管理员在右侧编辑区选择模板 "photo-text" 并上传 1 张图片、填写文字 "测试"
Then 该 page 的 templateId 更新为 "photo-text"
And content 更新为 { images: ["<上传后的URL>"], text: "测试" }

### Scenario: 图片上传自动压缩

Given 管理员选择了一张 3000x4000px 的 PNG 图片
When 图片上传流程执行
Then 图片被压缩为最长边 1200px 的 WebP 格式
And 通过 POST /photos/presign 获取上传凭证并上传到 R2

### Scenario: 预览功能

Given 管理员正在编辑某相册，已添加 3 个页面
When 管理员点击预览按钮
Then 打开与前台相同的翻页阅读视图，展示当前编辑的相册内容

### Scenario: 未登录访问管理后台

Given 用户未通过管理员认证
When 用户尝试访问相册管理页面
Then 被重定向到登录页面

---

## Constraints

- 相册 year 字段全局唯一
- 模板 templateId 仅允许: single, double-h, double-v, triple, photo-text
- 翻页动画帧率 >= 30fps
- 相册页面首屏渲染 <= 1 秒
- 浏览器支持: Chrome 90+, Safari 15+, Firefox 90+
- 页面比例固定 3:4
- 视口宽度 >= 768px 双页模式，< 768px 单页模式
- 图片上传前端压缩至最长边 1200px，格式 WebP
- 删除相册时必须级联删除关联 pages 及 R2 存储文件
- 所有写操作 API 需管理员认证，读操作公开
