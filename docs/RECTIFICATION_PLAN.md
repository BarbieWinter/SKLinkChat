# PROJECT RECTIFICATION PLAN

## 文档地址

- `docs/RECTIFICATION_PLAN.md`

## 整改目标

本次整改分为两部分：

1. 新增一个可复用的“复古像素风发送聊天气泡”组件，并在前端页面中接入可见位置用于验收。
2. 在个人资料展示区新增“性别像素小人标识”，同时补齐后端接口、数据库字段与前端资料编辑链路。

## 需求整理

### A. 复古像素风聊天气泡组件

- 风格必须是 `8-bit / pixel art / retro game UI`
- 禁止现代圆角和柔和阴影
- 主体为横向偏长矩形
- 浅粉填充，黑色粗描边
- 四角必须是像素切角
- 左下角必须有像素尾巴
- 使用 `DepartureMono-Regular.otf`
- 文本默认支持全大写与居中展示
- 组件必须可复用，文本内容可传参
- 实现方式必须体现真实像素边界

### B. 资料区性别像素小人

- 在 PROFILE 卡片昵称旁增加像素风 gender icon
- `male` 使用蓝色像素小人
- `female` 使用粉色像素小人
- `unknown` 使用低饱和灰色像素小人
- 风格必须和当前复古暗色像素 UI 一致
- 需要支持移动端对齐和小尺寸展示

### C. 后端与数据库

- `accounts` 表新增 `gender` 字段
- 字段值限制为：
  - `male`
  - `female`
  - `unknown`
- 默认值使用 `unknown`
- `/api/auth/session` 返回 `gender`
- `/api/account/profile` 返回 `gender`
- `/api/account/profile` 更新接口支持写入 `gender`

### D. 前端链路

- 更新 TS 类型
- 更新 auth session payload
- 更新 profile payload
- 在设置弹窗中允许编辑 gender
- 在资料卡昵称区域展示 gender 像素图标

## 实施方案

### 1. 聊天气泡

- 新建独立 React 组件，封装文本、对齐、大小与样式变体
- 在全局样式中加入 `@font-face`
- 字体路径固定为：`/fonts/DepartureMono-Regular.otf`
- 验收展示位置：
  - 聊天空状态中增加一枚可见的复古像素气泡
  - 聊天消息气泡渲染切换到该组件

### 2. 性别标识

- 新建独立的像素风 `PixelGenderIcon` 组件
- 使用 SVG + `shape-rendering="crispEdges"` 方式绘制像素块
- 昵称行结构改为：
  - `[像素 icon] [昵称]`

### 3. 数据模型

- 数据库 migration:
  - 新增 `0008_account_gender.py`
- SQLAlchemy model:
  - `Account.gender`
- Repository:
  - create 时默认 `unknown`
  - update_profile 支持更新 `gender`
- Service:
  - 增加 gender 归一化与 session/profile 返回

### 4. 编辑资料

- 设置弹窗新增性别字段
- 采用最简单稳妥方案：
  - 原生 `select`
  - 选项为 `unknown / male / female`

## 资源约定

字体文件请放到：

- `client/public/fonts/DepartureMono-Regular.otf`

本次代码会先把加载路径和样式接好，即使字体文件稍后再放入也不会阻塞构建。

## 验收点

- 打开前端后能看到新的复古像素气泡组件
- PROFILE 昵称旁能看到 gender 像素 icon
- 修改资料时可以保存 `gender`
- 刷新后 `/api/auth/session` 与 `/api/account/profile` 保持 `gender`
- 数据库迁移文件已就位，可直接执行 `alembic upgrade head`
