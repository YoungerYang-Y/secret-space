# P1 地图与照片 Spec

## Overview

在果果的房间墙面区域展示中国地图，已去过的省份被点亮，点击后可浏览该省份的照片。管理员可通过后台管理省份状态和照片。

## Behavior: 墙面 Zoom-In

### Scenario: 点击墙面热区进入地图

Given 用户处于房间全景视图
When 用户点击墙面区域热区
Then Camera 以 0.6 秒动画推进到墙面区域
And 动画结束后 SVG 地图覆盖层可见

### Scenario: 从地图返回全景

Given 用户处于墙面 zoom-in 视图
When 用户点击返回按钮
Then Camera 以 0.5 秒动画拉回全景
And SVG 地图覆盖层隐藏

### Scenario: 竖屏下墙面视图

Given 设备为竖屏
When 用户进入墙面区域
Then 地图自适应宽度显示
And 可上下滚动查看完整地图

## Behavior: 地图交互

### Scenario: 已去过省份高亮

Given 地图加载完成
And 湖南、广西、河北、广东标记为已去过
When 地图渲染
Then 这 4 个省份填充高亮色
And 其余省份为未点亮灰色
And 显示"已点亮 4/34"进度文字

### Scenario: Hover 已去过省份

Given 设备为 PC（有鼠标）
When 鼠标悬停在已去过的省份（如湖南）上
Then 该省份填充色变亮（hover 态）
And 显示省份名 tooltip "湖南"
And 光标变为可点击手型

### Scenario: Hover 未去过省份

Given 设备为 PC
When 鼠标悬停在未去过的省份上
Then 显示省份名 tooltip
And 光标保持默认
And 填充色不变

### Scenario: 点击已去过省份

Given 地图可见
And 湖南标记为已去过
When 用户点击湖南
Then 弹出照片面板
And 面板从湖南所在位置放大展开到全屏

### Scenario: 点击未去过省份

Given 地图可见
And 西藏标记为未去过
When 用户点击西藏
Then 无反应（不可点击）

### Scenario: 地图与 Camera 同步

Given 地图 SVG 覆盖在 Canvas 上
When 窗口 resize 或 Camera state 变化
Then SVG 容器的 CSS transform 与 PixiJS world container 保持同步
And 省份边界对齐准确（误差 ≤ 2px）

## Behavior: 照片面板

### Scenario: 打开照片面板

Given 用户点击了已去过的省份（广东）
When 面板动画完成
Then 全屏面板覆盖 Canvas（z-index 高于地图层）
And 显示该省份标题 "广东"
And 照片以瀑布流布局展示
And 照片按 order 字段升序排列

### Scenario: 照片懒加载

Given 照片面板已打开
And 该省有 10 张照片
When 面板渲染
Then 视口内照片立即加载
And 视口外照片滚动到可见时才加载
And 加载中显示占位色块

### Scenario: 照片标注

Given 照片面板已打开
And 某张照片有标注 "汕尾红海湾"
When 用户 hover 该照片（PC）或长按（移动端）
Then 浮出小纸条样式的标注文字

### Scenario: 关闭照片面板

Given 照片面板已打开
When 用户点击关闭按钮或面板外区域
Then 面板缩回到省份位置并消失
And 地图恢复可见
And 无闪烁或跳变

### Scenario: 空照片省份

Given 广西标记为已去过但无照片
When 用户点击广西
Then 面板打开
And 显示空状态："还没有照片，快去拍一些吧～"

## Behavior: 照片管理 API

### Scenario: 获取省份列表

Given 用户已认证（owner/visitor/admin 均可）
When GET /provinces
Then 返回 34 个省份数据（name, code, visited, photoCount）
And 按 code 字母序排列

### Scenario: 标记省份已去过

Given 管理员已认证
When PUT /provinces/hunan { visited: true }
Then 湖南的 visited 更新为 true
And 返回更新后的省份数据

### Scenario: 获取上传签名 URL

Given 管理员已认证
When POST /photos/presign { provinceCode: "hunan", filename: "beach.webp" }
Then 返回 R2 presigned PUT URL
And URL 有效期 10 分钟
And key 格式为 photos/hunan/{uuid}.webp

### Scenario: 创建照片记录

Given 管理员已认证
And 文件已上传到 R2
When POST /photos { provinceCode: "hunan", url: "https://...", annotation: "橘子洲", order: 1 }
Then 照片记录创建成功
And 返回照片 ID 和完整数据

### Scenario: 修改照片排序

Given 管理员已认证
And 湖南有 3 张照片
When PUT /photos/reorder { provinceCode: "hunan", photoIds: [3, 1, 2] }
Then 照片 order 按数组顺序更新为 1, 2, 3

### Scenario: 删除照片

Given 管理员已认证
When DELETE /photos/{id}
Then 照片记录删除
And R2 中对应文件删除
And 返回 204

### Scenario: 未认证访问管理 API

Given 用户未认证或 role 不是 admin
When 访问任何管理 API
Then 返回 403 Forbidden

### Scenario: 获取省份照片（公开）

Given 任何已认证用户（owner/visitor/admin）
When GET /provinces/hunan/photos
Then 返回湖南的所有照片（url, annotation, order）
And 按 order 升序排列

## Behavior: 管理后台

### Scenario: 管理员登录

Given 管理员在 admin 登录页
When 输入正确的 admin 密码
Then 登录成功，进入后台首页
And JWT 存储到 localStorage

### Scenario: 省份管理页

Given 管理员已登录
When 进入省份管理页
Then 显示 34 个省份列表
And 每个省份显示名称、已去过状态、照片数量
And 可切换省份的 visited 状态

### Scenario: 照片上传

Given 管理员在某省份详情页
When 选择文件并上传
Then 前端获取 presigned URL
And 直传文件到 R2
And 上传成功后创建照片记录
And 照片出现在列表中

### Scenario: 照片排序

Given 管理员在某省份详情页
And 该省有多张照片
When 拖拽调整照片顺序
Then 调用 reorder API 更新排序
And 列表顺序实时更新

### Scenario: 照片标注编辑

Given 管理员在某省份详情页
When 点击某张照片的标注区域
Then 弹出编辑输入框
And 保存后标注更新

## Constraints

- 照片面板首屏加载 ≤ 1 秒（视口内照片可见）
- 地图 SVG 文件 ≤ 100KB（gzipped）
- Presigned URL 有效期 10 分钟
- 支持浏览器：Chrome 90+、Safari 15+、Firefox 90+
- 管理后台仅需支持 Chrome 90+
- R2 key 格式：photos/{provinceCode}/{uuid}.webp
- 照片格式：WebP
- 管理 API 需 admin 角色鉴权
