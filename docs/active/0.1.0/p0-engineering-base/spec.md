# P0 Engineering Base Spec

## Overview

为"果果的秘密空间"项目搭建完整的工程基座：monorepo 结构、PixiJS 场景渲染、Camera 系统、密码认证入口，使后续功能开发可以在稳定的架构上快速迭代。

## Behavior: Monorepo 初始化

### Scenario: 全新安装

Given 用户克隆了仓库
When 在根目录执行 `pnpm install`
Then 所有 workspace 包的依赖安装成功
And `packages/client`、`packages/server`、`packages/shared` 三个包均可独立构建

### Scenario: 共享类型引用

Given shared 包导出了类型定义
When client 或 server 中 import shared 包的类型
Then TypeScript 编译无错误
And IDE 可以跳转到 shared 包源码

### Scenario: 开发环境启动

Given 依赖已安装
When 执行 `pnpm dev`（根目录）
Then client dev server 启动在端口 5173
And server 启动在端口 3000
And 两者可并行运行

## Behavior: PixiJS 场景渲染

### Scenario: 正常加载房间底图

Given 浏览器支持 WebGL2
When 页面加载完成
Then Canvas 元素全屏显示
And 房间底图居中渲染在 960×540 世界坐标系内
And 画面按 letterbox 策略适配屏幕（保持 16:9 宽高比，上下或左右留黑边）

### Scenario: WebGL 不可用

Given 浏览器不支持 WebGL2
When 页面加载
Then 显示友好的降级提示（文字说明需要现代浏览器）
And 不抛出未捕获异常

### Scenario: 窗口 Resize

Given 场景已渲染
When 浏览器窗口尺寸变化
Then Canvas 重新适配新尺寸
And 世界坐标系内容保持正确比例（不拉伸变形）
And resize 后 1 帧内完成适配（无中间态闪烁）

## Behavior: Camera Zoom-In

### Scenario: 横屏点击热区 Zoom-In

Given 设备为横屏（宽 > 高）
And 当前处于全景视图（scale=1.0）
When 用户点击某个热区物品
Then Camera 以 0.6 秒缓动动画推进到该热区
And 动画结束后 scale = 2.5
And 世界容器位移使热区中心对齐视口中心（误差 ≤ 1px）

### Scenario: 横屏 Zoom-Out 回全景

Given 当前处于 Zoom-In 状态
When 用户点击返回按钮
Then Camera 以 0.5 秒缓动动画拉回全景
And 恢复到初始缩放比和位置

### Scenario: 竖屏区域滑动

Given 设备为竖屏（高 > 宽）
And 当前处于 Zoom-In 状态
When 用户左滑或右滑
Then Camera 平滑切换到相邻区域
And 顶部导航指示器更新当前区域位置

### Scenario: Zoom-In 状态性能优化

Given Camera 完成 Zoom-In 到某区域
When 渲染循环执行
Then 视口外精灵的 renderable 设为 false
And 区域外粒子系统暂停

## Behavior: 密码认证

### Scenario: 正确密码解锁

Given 用户在密码输入页
When 输入正确的果果密码并提交
Then 返回认证令牌（JWT）
And 令牌存储到 localStorage
And 页面跳转到场景加载流程

### Scenario: 正确访客密码

Given 用户在密码输入页
When 输入正确的访客密码并提交
Then 返回认证令牌（JWT），标记角色为 visitor
And 令牌存储到 localStorage
And 页面跳转到场景加载流程

### Scenario: 错误密码

Given 用户在密码输入页
When 输入错误密码并提交
Then 显示"密码不对哦"提示
And 密码输入框清空
And 不生成令牌

### Scenario: 暴力破解防护

Given 同一 IP 在 5 分钟内已提交 10 次错误密码
When 再次提交密码
Then 返回 429 状态码
And 提示"休息一下再试吧"
And 5 分钟后恢复

### Scenario: 令牌持久化

Given 用户已认证且 localStorage 中存有有效令牌
When 用户关闭浏览器后重新访问
Then 自动跳过密码页直接进入场景加载
And 无需重新输入密码

### Scenario: 令牌过期

Given localStorage 中的令牌已过期（超过 7 天）
When 用户访问页面
Then 自动清除过期令牌
And 显示密码输入页

## Behavior: 场景加载体验

### Scenario: 正常加载

Given 用户通过密码认证
When 场景资源开始加载
Then 显示加载画面（门缝猫偷看动画）
And 展示随机 loading 小贴士
And 显示进度条，进度值从 0 递增到 1

### Scenario: 加载完成过渡

Given 所有首屏资源加载完成
When 加载画面结束
Then 播放开门动画（门推开 + 吱呀声效，时长 1.5 秒）
And 动画结束后显示房间全景

### Scenario: 加载超时

Given 场景资源加载中
When 超过 15 秒仍未完成
Then 显示友好提示（"加载有点慢，再等等？"）
And 提供重试按钮

## Behavior: 音频系统

### Scenario: 首次交互解锁

Given 用户首次进入页面（移动端 Audio Context 被锁定）
When 用户执行首次交互（点击/触摸）
Then Audio Context 解锁
And 环境音开始播放（淡入 1 秒）

### Scenario: 环境音播放

Given Audio Context 已解锁
When 进入房间场景
Then 播放当前季节对应的环境音（循环）
And 音量为默认值 0.3

### Scenario: 音效触发

Given Audio Context 已解锁
When 触发特定交互（如开门）
Then 播放对应音效（一次性）
And 不中断环境音

### Scenario: 音频加载失败

Given 某音频资源加载失败
When 需要播放该音频时
Then 静默跳过（不阻塞交互）
And 控制台输出警告日志

## Behavior: 自定义光标

### Scenario: PC 端光标替换

Given 设备为 PC（有鼠标指针）
When 页面渲染完成
Then 默认光标替换为卡通箭头光标
And 可交互元素上光标变为卡通手指光标

### Scenario: 移动端无光标

Given 设备为触屏设备
When 页面渲染完成
Then 不应用自定义光标样式（使用系统默认触摸行为）

## Behavior: 响应式适配

### Scenario: 横屏全景

Given 设备宽高比 ≥ 16:9
When 页面渲染
Then 画面上下 letterbox
And 左右无黑边

### Scenario: 竖屏适配

Given 设备为竖屏
When 进入 Zoom-In 区域
Then 显示区域级视图（单区域填满宽度）
And 顶部显示导航指示器（当前区域索引/总数）
And 支持左右滑动切换区域

### Scenario: 横竖屏切换

Given 用户旋转设备
When 屏幕方向改变
Then 自动切换适配模式（横屏全景 / 竖屏区域）
And CameraState.mode 和 currentZoneId 保持不变

## Constraints

- 首屏资源总量 ≤ 1.5MB（gzipped）
- PixiJS 场景帧率 ≥ 55fps（中等配置设备）
- 密码校验 API 响应时间 P95 ≤ 200ms
- JWT 有效期 7 天
- 暴力破解限流：同 IP 5 分钟内最多 10 次尝试
- 支持浏览器：Chrome 90+、Safari 15+、Firefox 90+
- 移动端最低支持：iOS 15+、Android 10+
