# SKLinkChat — Frontend Visual Redesign

> **Reference**: [vibeisland.app](https://vibeisland.app/)
> **Scope**: Pure visual layer — no backend changes, no feature logic changes
> **Date**: 2026-04-06

---

## Table of Contents

1. [Design Direction](#1-design-direction)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Radius](#4-spacing--radius)
5. [Component Specification](#5-component-specification)
6. [Page-Level Redesign](#6-page-level-redesign)
7. [Motion & Effects](#7-motion--effects)
8. [Responsive Strategy](#8-responsive-strategy)
9. [Implementation Plan](#9-implementation-plan)
10. [Technical Constraints](#10-technical-constraints)

---

## 1. Design Direction

### 1.1 Current State

SKLinkChat 目前使用典型的 SaaS 风格：Inter 无衬线字体、Sky Blue (`hsl(217,91%,60%)`) 主色、大圆角 (`rounded-2xl` / `rounded-3xl`)、渐变气泡消息、毛玻璃侧边栏。整体干净但缺乏辨识度。

### 1.2 Target Aesthetic: **Dark Terminal Elegance**

借鉴 Vibe Island 的核心设计语言——等宽字体、深色底、精致的边框层次、像素级动效——但不照搬其产品形态。SKLinkChat 是聊天产品，需要在终端美学和**对话可读性**之间取得平衡。

**设计四原则**：

| 原则 | 说明 |
|------|------|
| **暗色沉浸** | 深黑底色消除视觉干扰，让对话内容成为唯一焦点 |
| **等宽质感** | JetBrains Mono 全站统一，传递技术感与匿名感 |
| **精致克制** | 颜色不超过 3 种主调；装饰性元素低透明度；留白大于填充 |
| **微妙交互** | 鼠标悬停发光、文字 scramble 揭示、扫描线——让界面"活着"但不吵闹 |

### 1.3 Before / After Comparison

```
 BEFORE                              AFTER
 ───────────────────                  ───────────────────
 Font: Inter (Sans)                   Font: JetBrains Mono
 Primary: Sky Blue                    Primary: Cyan #06b6d4
 Radius: 16-32px                      Radius: 4-8px
 Messages: Gradient bubbles           Messages: Flat cards, subtle border
 Background: Plain                    Background: Noise grain + scan line
 Sidebar: Glassmorphism               Sidebar: Solid dark + 1px border
 Buttons: Rounded pills               Buttons: Sharp rectangles + glow
 Overall: Friendly SaaS               Overall: Dark terminal elegance
```

---

## 2. Color System

保留现有 CSS Variable + HSL 架构，仅替换色值。Tailwind 配置无结构性变更。

### 2.1 Dark Theme (Default)

```css
.dark {
  /* ── Surfaces ── */
  --background:            220 14% 5%;       /* #0b0d10  — 主背景，接近纯黑带一丝蓝 */
  --foreground:            220 10% 86%;      /* #d5d8dd  — 主文字，柔和浅灰 */

  --card:                  220 14% 8%;       /* #111419  — 卡片/面板底色 */
  --card-foreground:       220 10% 86%;

  --popover:               220 14% 10%;      /* #161a21  — 弹层 */
  --popover-foreground:    220 10% 86%;

  /* ── Brand: Cyan ── */
  --primary:               187 72% 48%;      /* #22b8cf  — 主品牌色，克制的青 */
  --primary-foreground:    220 14% 5%;       /* 深底反色 */

  /* ── Neutral Fills ── */
  --secondary:             220 12% 13%;      /* #1b1f27  — 次要面板 */
  --secondary-foreground:  220 10% 72%;

  --muted:                 220 10% 15%;      /* #212631  — 静音/弱化区域 */
  --muted-foreground:      220 8% 48%;       /* #6e7582  — 辅助文字 */

  /* ── Accent: Warm Amber ── */
  --accent:                38 90% 55%;       /* #f0a020  — 点缀色，暖调平衡冷色 */
  --accent-foreground:     220 14% 5%;

  /* ── Destructive ── */
  --destructive:           0 65% 48%;        /* #c93030  — 低饱和红，不刺眼 */
  --destructive-foreground: 0 0% 96%;

  /* ── Borders & Inputs ── */
  --border:                220 10% 16%;      /* #242930  — 1px 分割线 */
  --input:                 220 12% 12%;      /* #1a1e25  — 输入框底色 */
  --ring:                  187 72% 48%;      /* 聚焦环 = primary */

  /* ── Radius ── */
  --radius:                0.375rem;         /* 6px — 介于直角和大圆角之间 */
}
```

### 2.2 Light Theme

```css
:root {
  --background:            210 20% 97%;      /* #f5f7fa  — 冷调纸白 */
  --foreground:            220 14% 10%;

  --card:                  0 0% 100%;
  --card-foreground:       220 14% 10%;

  --popover:               0 0% 100%;
  --popover-foreground:    220 14% 10%;

  --primary:               187 65% 40%;      /* #249dac  — 青色降亮 */
  --primary-foreground:    0 0% 100%;

  --secondary:             220 14% 93%;
  --secondary-foreground:  220 14% 20%;

  --muted:                 220 14% 93%;
  --muted-foreground:      220 8% 45%;

  --accent:                38 85% 48%;       /* 琥珀色降饱和 */
  --accent-foreground:     220 14% 8%;

  --destructive:           0 70% 52%;
  --destructive-foreground: 0 0% 98%;

  --border:                220 14% 88%;
  --input:                 220 14% 92%;
  --ring:                  187 65% 40%;

  --radius:                0.375rem;
}
```

### 2.3 Extended Semantic Tokens

在 Tailwind 中扩展以下语义色，用于特定场景：

| Token | Value (Dark) | Use Case |
|-------|-------------|----------|
| `cyber` | `hsl(187 72% 48%)` | = primary，语义别名 |
| `terminal` | `hsl(142 60% 55%)` | 系统消息、成功状态 |
| `amber` | `hsl(38 90% 55%)` | = accent，强调标签 |
| `surface-0` | `hsl(220 14% 5%)` | = background |
| `surface-1` | `hsl(220 14% 8%)` | = card |
| `surface-2` | `hsl(220 12% 13%)` | = secondary，raised panels |

### 2.4 Color Palette Visualization

```
  Dark Theme Surfaces               Accent Palette
  ┌───────────────────┐            ┌─────────────────────┐
  │                   │ #0b0d10    │  ██  Cyan   #22b8cf │
  │  surface-0        │            │  ██  Amber  #f0a020 │
  │  ┌─────────────┐  │            │  ██  Green  #4ade80 │
  │  │             │  │ #111419    │  ██  Red    #c93030 │
  │  │  surface-1  │  │            └─────────────────────┘
  │  │  ┌───────┐  │  │
  │  │  │ s-2   │  │  │ #1b1f27    Text Hierarchy
  │  │  └───────┘  │  │            ┌─────────────────────┐
  │  └─────────────┘  │            │  ██  Primary  #d5d8dd│
  └───────────────────┘            │  ██  Muted    #6e7582│
                                   │  ██  Faint    #3a3f4a│
  Border: #242930 (1px)            └─────────────────────┘
```

---

## 3. Typography

### 3.1 Font Stack

```css
/* 主字体：等宽 */
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;

/* 装饰字体：像素风，仅用于 Logo 和极少数标题 */
--font-pixel: 'Silkscreen', 'Press Start 2P', monospace;
```

**加载方式**: 通过 `@fontsource/jetbrains-mono` npm 包引入（支持 variable font），避免外部 CDN 依赖。

```bash
npm install @fontsource-variable/jetbrains-mono
```

```ts
// main.tsx
import '@fontsource-variable/jetbrains-mono'
```

### 3.2 Tailwind Config Update

```js
// tailwind.config.js
fontFamily: {
  sans: ['JetBrains Mono', 'Fira Code', 'monospace'],  // 全站 fallback 改为等宽
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  pixel: ['Silkscreen', 'Press Start 2P', 'monospace'],
}
```

### 3.3 Type Scale

| Token | Size | Weight | Letter Spacing | Use Case |
|-------|------|--------|----------------|----------|
| `text-2xl` | 24px | 700 | -0.02em | Logo / Hero |
| `text-xl` | 20px | 600 | -0.01em | Page Title |
| `text-lg` | 17px | 600 | 0 | Section Title |
| `text-base` | 14px | 400 | 0.01em | Body / Messages |
| `text-sm` | 13px | 500 | 0.01em | Labels / Sidebar |
| `text-xs` | 11px | 500 | 0.04em | Timestamps / Captions |

> **Note**: 等宽字体天然比 Sans 字体宽约 15-20%。整体字号下调 1px，letter-spacing 微调以维持相同信息密度。

### 3.4 Text Rendering

```css
body {
  font-feature-settings: 'liga' 1, 'calt' 1;  /* 连字 */
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

---

## 4. Spacing & Radius

### 4.1 Border Radius

| 现有值 | 新值 | 说明 |
|--------|------|------|
| `rounded-full` (pills) | `rounded` (4px) | Tags / Badges |
| `rounded-2xl` (16px) | `rounded-lg` (6px) | Cards / Inputs |
| `rounded-3xl` (24px) | `rounded-lg` (6px) | Message Bubbles |
| `rounded-[28px]` | `rounded-lg` (6px) | Auth Card |
| `rounded-[32px]` | `rounded-xl` (8px) | Mobile Drawer |

**原则**: 最大圆角不超过 `8px`，保持棱角分明的终端质感。

### 4.2 Border Style

```css
/* 主分割线：1px solid，低对比 */
border: 1px solid hsl(var(--border));

/* 卡片/面板强调边框 */
border: 1px solid hsl(var(--border) / 0.6);

/* Focus / Active 状态 */
border-color: hsl(var(--primary));
box-shadow: 0 0 0 1px hsl(var(--primary) / 0.15);

/* 禁止使用 ring-1 ring-border/20 等多重边框叠加 */
```

### 4.3 Shadow System

```css
/* 去掉所有 shadow-md / shadow-lg / shadow-2xl */
/* 仅保留以下两级 */

--shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.15);          /* 按钮、输入框 */
--shadow-glow: 0 0 20px hsl(var(--primary) / 0.12);   /* Hover 发光 */
```

---

## 5. Component Specification

### 5.1 Button

**文件**: `client/src/shared/ui/button.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  Variant        Background          Border        Text      │
│  ─────────────  ──────────────────  ──────────    ──────    │
│  default        primary             none          p-fg      │
│  secondary      surface-2           1px border    fg        │
│  outline        transparent         1px border    fg        │
│  ghost          transparent         none          muted-fg  │
│  destructive    destructive/10      1px dest      dest      │
│  link           transparent         none          primary   │
└─────────────────────────────────────────────────────────────┘
```

**Hover Effects**:
- `default`: `box-shadow: 0 0 24px hsl(187 72% 48% / 0.25)` — 青色发光
- `secondary / outline`: `border-color → primary`, `color → primary`
- `ghost`: `background → muted/50`
- `destructive`: `background → destructive`, `color → destructive-foreground`

**Sizes**:
| Size | Height | Padding | Font |
|------|--------|---------|------|
| `sm` | 32px | px-3 | 12px |
| `default` | 36px | px-4 | 13px |
| `lg` | 40px | px-6 | 14px |
| `icon` | 36px | - | - |

**Active State**: `transform: scale(0.97)` + `transition: 80ms`

### 5.2 Input / Textarea

**文件**: `client/src/shared/ui/input.tsx`, `client/src/shared/ui/textarea.tsx`

```
 ┌──────────────────────────────────────────┐
 │ >_ placeholder text                      │
 └──────────────────────────────────────────┘
 bg: var(--input)  |  border: 1px var(--border)
 h: 40px           |  rounded: var(--radius) = 6px
 font: JetBrains Mono 14px
 padding: 0 12px 0 32px  (为左侧 >_ 预留空间)

 Focus:
   border-color: var(--primary)
   box-shadow: 0 0 0 2px hsl(187 72% 48% / 0.08)

 Prefix:
   伪元素 ">_" 或通过 padding-left + absolute positioned span
   color: var(--muted-foreground)
   font-weight: 500
```

**AuthEntryCard 中的输入框**: 高度 44-48px，其余同上。

### 5.3 Badge / Tag

**文件**: `client/src/shared/ui/badge.tsx`

```
 现有:  rounded-full bg-primary/10 text-primary
 新增:  rounded (4px) border-1 border-primary/30 bg-primary/5 text-primary
        font: 11px, uppercase, tracking-wider (0.06em)
        padding: 2px 8px
        
 Example: [MUSIC] [CODE] [FILM]
```

Variant 保持 `default / secondary / destructive / outline`，但视觉从圆形药丸改为方形标签。

### 5.4 Dialog / Modal

**文件**: `client/src/shared/ui/dialog.tsx`

```
 ╔═══════════════════════════════════════╗
 ║  ░ SETTINGS                    [ × ] ║  ← 标题栏：surface-2 底色
 ╠═══════════════════════════════════════╣
 ║                                       ║
 ║  (Content Area)                       ║  ← surface-1 底色
 ║                                       ║
 ╚═══════════════════════════════════════╝

 Max-width: 420px
 Rounded: 8px
 Border: 1px solid var(--border)
 Shadow: --shadow-glow (微弱的 primary 色光晕)

 Backdrop: bg-black/70 + backdrop-blur(4px)
 Close Button: "×" 文字，hover 时 text-primary
```

### 5.5 Toast / Notification

**文件**: `client/src/shared/ui/toast.tsx`

```
 ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
 ┊ ▎ [INFO] Toast message here         ┊
 └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
   ▎= 3px left border (primary / destructive / terminal)
   bg: surface-1
   border: 1px var(--border)
   rounded: 6px
   prefix: [INFO] / [WARN] / [ERROR] — uppercase, 11px, muted color
```

---

## 6. Page-Level Redesign

### 6.1 AuthEntryCard

**文件**: `client/src/features/auth/ui/auth-entry-card.tsx`

#### 6.1.1 Layout

```
 ┌──────────────────────────────────────────────────────────┐
 │  (background: surface-0 + noise grain overlay)           │
 │                                                          │
 │  ┌─────────────────────┐  ┌──────────────────────────┐  │
 │  │                     │  │                          │  │
 │  │  S K L I N K        │  │  ░ 注册账号              │  │
 │  │  C H A T            │  │  ──────────────────────  │  │
 │  │                     │  │                          │  │
 │  │  ─────────────────  │  │  ┌────────────────────┐  │  │
 │  │                     │  │  │ >_ email@addr      │  │  │
 │  │  ▸ 匿名开聊         │  │  └────────────────────┘  │  │
 │  │    不需要公开真实    │  │  ┌────────────────────┐  │  │
 │  │    身份...          │  │  │ >_ ••••••••         │  │  │
 │  │                     │  │  └────────────────────┘  │  │
 │  │  ▸ 即时连接         │  │  ┌────────────────────┐  │  │
 │  │    完成登录后即可    │  │  │ >_ display_name    │  │  │
 │  │    开始匹配...      │  │  └────────────────────┘  │  │
 │  │                     │  │  ┌────────────────────┐  │  │
 │  │  ▸ 隐私优先         │  │  │ >_ interests,tags  │  │  │
 │  │    把表达留给当下    │  │  └────────────────────┘  │  │
 │  │                     │  │                          │  │
 │  │  ─────────────────  │  │  [GeeTest CAPTCHA]       │  │
 │  │                     │  │                          │  │
 │  │  [MUSIC] [CODE]     │  │  ┌════════════════════┐  │  │
 │  │  [FILM]  [CHAT]     │  │  │    [ CONNECT ]     │  │  │
 │  │                     │  │  └════════════════════┘  │  │
 │  │                     │  │                          │  │
 │  └─────────────────────┘  │  已有账号? [LOGIN]       │  │
 │  (hidden on mobile)       └──────────────────────────┘  │
 │                                                          │
 └──────────────────────────────────────────────────────────┘
```

#### 6.1.2 Key Changes

| Element | Before | After |
|---------|--------|-------|
| **背景** | 渐变圆球 blur + 网格动画 | 纯 `surface-0` + 噪点纹理叠层 |
| **左栏** | `bg-slate-950` + `rounded-[32px]` + `shadow-2xl` | `surface-1` + `rounded-lg` + `1px border` |
| **右栏** | `bg-slate-950/70` + `rounded-[28px]` + `backdrop-blur-xl` | `surface-1` + `rounded-lg` + `1px border` |
| **Logo** | `text-3xl font-semibold` Inter | `text-2xl font-bold font-mono tracking-wider` + 可选 ASCII Art |
| **Badge** | `rounded-full bg-white/10` | `rounded border border-primary/20 text-xs tracking-widest` |
| **Feature List** | Framer Motion hover scale + `bg-white/10` cards | 左侧 `▸` 前缀，无卡片包裹，简约排列 |
| **Tab 切换** | `rounded-2xl` 滑块 | 底部 1px underline indicator，类似终端 tab |
| **输入框** | `h-14 rounded-2xl bg-slate-950/80` | `h-11 rounded-lg bg-input` + `>_` prefix |
| **主按钮** | `bg-gradient-to-r from-primary via-sky-500 to-cyan-500 rounded-2xl shadow-md` | `bg-primary rounded-lg` + hover glow |
| **辅助链接** | `text-muted-foreground hover:text-primary` | `text-primary/70 hover:text-primary underline` |

#### 6.1.3 Background Treatment

移除所有 Framer Motion 动画圆球和 radial-gradient 背景。替换为：

```css
/* Noise grain overlay — 全局一次性使用 */
.noise-overlay::before {
  content: '';
  position: fixed;
  inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 1;
}
```

### 6.2 ChatWorkspace

**文件**: `client/src/features/chat/ui/chat-workspace.tsx`

#### 6.2.1 Sidebar

```
 ┌────────────────────┐
 │  ░ WORKSPACE       │  ← section header, uppercase, 11px, tracking-widest
 │  ──────────────────│
 │                    │
 │  ┌──────────────┐  │
 │  │  PROFILE     │  │
 │  │  ────────    │  │
 │  │  name_here   │  │  ← 等宽字体直接显示
 │  │  ID: a3f8    │  │
 │  │              │  │
 │  │  [MUSIC]     │  │  ← 方括号标签
 │  │  [CODE]      │  │
 │  │  [FILM]      │  │
 │  │              │  │
 │  │  [SETTINGS]  │  │  ← 文字按钮风格
 │  │  [LOGOUT]    │  │
 │  └──────────────┘  │
 │                    │
 │  ┌──────────────┐  │
 │  │  PARTNER     │  │
 │  │  ────────    │  │
 │  │  (none)      │  │
 │  │  等待匹配...  │  │
 │  └──────────────┘  │
 │                    │
 └────────────────────┘

 Width: 280px (from 300px)
 bg: surface-1
 border-right: 1px solid var(--border)
 去掉: backdrop-blur, bg-card/30, rounded-2xl 内部卡片圆角
 保留: Framer Motion 展开/收起动画
```

**Key Changes**:
- 移除 `backdrop-blur-xl`、`bg-card/30` 毛玻璃效果
- 内部卡片改为 `surface-2` 底色 + `1px border` + `rounded-md` (4px)
- Icon 容器 (`h-8 w-8 rounded-lg bg-primary/10`) 改为纯文字 section header
- Badge 改为方括号标签风格
- Logout 按钮改为 `[LOGOUT]` 等宽文字，destructive 色

#### 6.2.2 Chat Header

```
 ┌────────────────────────────────────────────────────┐
 │  [≡]  ● 42 online  │  stranger_42 · 在线  │ [⟳]  │
 └────────────────────────────────────────────────────┘

 Height: 48px (from h-12/h-14)
 bg: surface-0
 border-bottom: 1px solid var(--border)
 去掉: backdrop-blur-xl, bg-background/80, rounded-full 状态胶囊
```

**Changes**:
- 状态指示器从胶囊 (`rounded-full border bg-card/45`) 改为 inline text: `stranger_42 · 在线`
- 在线人数: `● 42` — 绿色圆点 + 数字，无外包装
- Reroll 按钮: `[⟳]` 或 `[NEXT]` 文字风格
- 去掉 `backdrop-blur-xl`、`shadow-sm`

### 6.3 Message List

**文件**: `client/src/features/chat/ui/virtual-message-list.tsx`

#### 6.3.1 Message Bubbles → Flat Cards

```
 ── 现有 (气泡模式) ──
 
                            ┌───────────────────┐
                            │ 渐变蓝背景 圆角气泡 │
                            └───────────────────┘

 ── 新版 (平面卡片模式) ──

 stranger_42                              14:23
 ┌──────────────────────────────────────┐
 │  你好，在干嘛？                       │
 └──────────────────────────────────────┘

                                          14:24
           ┌──────────────────────────────────┐
           │  嘿，刚下班，你呢？                │
           └──────────────────────────────────┘

 >_ system: stranger_42 已离开               14:25
```

| Element | Before | After |
|---------|--------|-------|
| **我的消息** | `bg-gradient-to-br from-primary via-blue-600 to-cyan-500 rounded-3xl rounded-br-lg shadow-md` | `bg-primary/8 border border-primary/20 rounded-md` text-foreground |
| **对方消息** | `bg-card rounded-3xl rounded-bl-lg ring-1 ring-border/40 backdrop-blur-xl` | `bg-surface-2 border border-border rounded-md` |
| **系统消息** | `rounded-full bg-muted/50 ring-1 ring-border/20 uppercase tracking-wider` | `text-terminal/70 text-xs` 前缀 `>_`，无背景包装 |
| **发送者名** | `text-primary/70 uppercase tracking-tight` | `text-amber text-xs` 显示在消息上方 |
| **时间戳** | 无 | `text-xs text-muted-foreground` 右对齐，显示在消息同行或上方 |

#### 6.3.2 Empty State

```
                    ┌───────────────┐
                    │   ░░░   ░░░   │
                    │   ░░░░░░░░░   │
                    │    ░░░░░░░    │
                    │     ░░░░░     │ ← 简化的像素图标
                    └───────────────┘
                    
                    等待连接...
                    
                    点击开始匹配
                    
                    [ START ]
```

- 移除 Sparkles 图标 + 渐变圆角容器 + 弹跳动画
- 使用简单的 ASCII 或像素风 icon
- 按钮: `bg-primary text-primary-foreground rounded-md` + hover glow
- 加载指示: 三个 `·` 字符顺序闪烁 (CSS animation)

### 6.4 Composer (输入区)

```
 ┌────────────────────────────────────────────────────┐
 │  >_ 输入消息...                          [SEND]   │
 └────────────────────────────────────────────────────┘

 bg: surface-0
 border-top: 1px solid var(--border)
```

| Element | Before | After |
|---------|--------|-------|
| **Textarea** | `rounded-2xl border-border/50 bg-muted/30` + focus ring | `rounded-md bg-input border-border` + `>_` prefix |
| **Send Button** | `rounded-2xl bg-primary w-11 h-11` icon-only | `rounded-md bg-primary px-4 h-9` 文字 `SEND` 或 icon `⏎` |
| **Layout** | `max-w-3xl` centered | 同上，保持 |

### 6.5 Settings Dialog

**文件**: `client/src/features/settings/ui/settings-dialog.tsx`

- 标题: `═══ SETTINGS ═══` 风格
- 表单字段同输入框规范
- 保存按钮: `[ SAVE ]`
- Trigger 按钮: `[SETTINGS]` 文字样式，去掉 Framer Motion hover/tap 动画

### 6.6 Admin Pages

**文件**: `client/src/features/admin/ui/*.tsx`

- Tab 导航: `[REPORTS]  [AUDIT]` — active tab 下划线 primary 色
- 表格: `font-mono text-sm`，行间 `border-bottom: 1px`，行 hover `bg-muted/30`
- 表头: `text-xs uppercase tracking-widest text-muted-foreground`，border-bottom 2px

---

## 7. Motion & Effects

### 7.1 Animation Principles

| 原则 | 细节 |
|------|------|
| **Duration** | 大多数过渡 `150-200ms`，不超过 `300ms` |
| **Easing** | `ease-out` 为主，弹性动画仅在页面级转场使用 |
| **Trigger** | Hover / Focus / Enter / Exit，不做无触发的循环动画 |
| **Reduced Motion** | 全部动画 respect `prefers-reduced-motion: reduce` |

### 7.2 保留的动画

| Animation | Usage | Change |
|-----------|-------|--------|
| `message-in` | 新消息出现 | 保留，duration 缩短至 `0.15s` |
| `fade-in` | 通用淡入 | 保留 `0.2s` |
| `slide-up` | Mobile drawer | 保留 |
| `pulse-dot` | 在线状态指示 | 保留 |

### 7.3 移除的动画

| Animation | Reason |
|-----------|--------|
| `float` | 不符合终端风格 |
| `gradient-shift` | 无渐变背景 |
| Auth 背景圆球动画 | 用噪点纹理替代 |
| Feature card `whileHover: scale(1.02)` | 过度活泼 |

### 7.4 新增动画

```css
/* ── Glow Pulse: 主按钮 hover ── */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 12px hsl(187 72% 48% / 0.15); }
  50%      { box-shadow: 0 0 28px hsl(187 72% 48% / 0.30); }
}
.animate-glow {
  animation: glow-pulse 2s ease-in-out infinite;
}

/* ── Blink Cursor: 输入框前缀 ── */
@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}
.animate-blink {
  animation: blink-cursor 1s step-end infinite;
}

/* ── Scanline: 微弱 CRT 效果 (optional, can be toggled) ── */
.scanline-overlay::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    hsl(0 0% 0% / 0.015) 2px,
    hsl(0 0% 0% / 0.015) 4px
  );
  pointer-events: none;
  z-index: 9998;
}
```

### 7.5 Text Scramble Effect (Optional, Phase 4)

新消息到达时文字从随机字符逐步揭示为正确字符，40ms 一个字符。

```ts
// shared/hooks/use-scramble.ts
function useScramble(text: string, options?: { speed?: number; charset?: string }) {
  // Returns { displayText, isAnimating }
  // Only trigger for messages < 100 chars to avoid performance issues
}
```

### 7.6 ASCII Particle Background (Optional, Phase 4)

Canvas 层散布 `0 1 + - * : .` 字符，鼠标接近时局部字符亮起 (cyan 色)。

- 仅桌面端 (`min-width: 1024px`)
- 仅 Auth 页面，不在聊天页面（避免分散注意力）
- `opacity: 0.02-0.06`，极其微弱
- 用 `requestAnimationFrame`，tab 不可见时暂停

---

## 8. Responsive Strategy

### 8.1 Breakpoints (Unchanged)

| Name | Width | Behavior |
|------|-------|----------|
| Mobile | < 640px | 单栏，drawer 侧边栏 |
| Tablet | 640-1279px | 单栏，sidebar hidden |
| Desktop | >= 1280px | 双栏，sidebar visible |

### 8.2 Mobile-Specific Adjustments

| Element | Desktop | Mobile |
|---------|---------|--------|
| Font size body | 14px | 14px (不变) |
| Input height | 40px | 44px (touch-friendly) |
| Message max-width | 70% | 88% (保持) |
| ASCII particles | Enabled | Disabled |
| CRT scanline | Enabled | Disabled |
| Composer `>_` prefix | 显示 | 显示 |

### 8.3 Mobile Drawer

```
 ┌────────────────────────────────┐
 │          ──── (handle)         │  ← 1.5px × 40px, muted color
 │                                │
 │  (Sidebar content)             │
 │                                │
 └────────────────────────────────┘

 Rounded: 8px (top)  — from 32px
 Border: 1px solid var(--border)
 Backdrop: bg-black/60 (保持)
 去掉: mx-2 mb-2 的 margin (改为 inset-x-0 bottom-0 无间距)
```

### 8.4 Safe Area (Unchanged)

保留现有 `safe-area-top / safe-area-bottom / safe-area-x` 支持。

---

## 9. Implementation Plan

### Phase 1: Foundation (Day 1-2)

建立新设计系统的基础层，所有后续工作依赖此阶段。

| # | Task | Files | Detail |
|---|------|-------|--------|
| 1.1 | 安装 JetBrains Mono | `package.json`, `main.tsx` | `@fontsource-variable/jetbrains-mono` |
| 1.2 | 替换 CSS 变量 (dark + light) | `global.css` | 按 Section 2 色值表 |
| 1.3 | 更新 Tailwind Config | `tailwind.config.js` | fontFamily, 新增语义色, radius |
| 1.4 | 新增 keyframes & utility classes | `global.css` | glow-pulse, blink-cursor, scanline, noise |
| 1.5 | 移除旧动画 | `global.css` | float, gradient-shift |

### Phase 2: Shared Components (Day 2-3)

逐个更新共享组件的视觉样式。

| # | Task | Files |
|---|------|-------|
| 2.1 | Button variants 重写 | `shared/ui/button.tsx` |
| 2.2 | Input 终端风格 + `>_` prefix | `shared/ui/input.tsx` |
| 2.3 | Textarea 同步 Input 风格 | `shared/ui/textarea.tsx` |
| 2.4 | Badge 方括号标签 | `shared/ui/badge.tsx` |
| 2.5 | Dialog 终端窗口化 | `shared/ui/dialog.tsx` |
| 2.6 | Toast 左侧色条 + prefix | `shared/ui/toast.tsx`, `toaster.tsx` |

### Phase 3: Feature Pages (Day 3-5)

更新各功能页面的布局和样式。

| # | Task | Files |
|---|------|-------|
| 3.1 | AuthEntryCard 整体重写样式 | `features/auth/ui/auth-entry-card.tsx` |
| 3.2 | ChatWorkspace Sidebar 改造 | `features/chat/ui/chat-workspace.tsx` |
| 3.3 | ChatPanel Header + Composer | `features/chat/ui/chat-panel.tsx` |
| 3.4 | VirtualMessageList 消息卡片 | `features/chat/ui/virtual-message-list.tsx` |
| 3.5 | SettingsDialog | `features/settings/ui/settings-dialog.tsx` |
| 3.6 | Admin Layout + Pages | `features/admin/ui/*.tsx` |
| 3.7 | OnlineUserCount | `features/presence/ui/online-user-count.tsx` |
| 3.8 | ModeToggle | `app/mode-toggle.tsx` |

### Phase 4: Polish (Day 5-7)

可选增强，独立于核心样式。

| # | Task | Files | Priority |
|---|------|-------|----------|
| 4.1 | 噪点纹理 SVG 叠层 | `global.css` | High |
| 4.2 | CRT 扫描线效果 (toggleable) | `global.css` | Medium |
| 4.3 | ASCII 粒子 Canvas (Auth page only) | 新建 `shared/ui/ascii-particles.tsx` | Low |
| 4.4 | Text scramble hook | 新建 `shared/hooks/use-scramble.ts` | Low |
| 4.5 | Light theme 调试 | `global.css` | High |
| 4.6 | Mobile 全面回归测试 | All | High |
| 4.7 | Lighthouse Performance audit | - | Medium |

---

## 10. Technical Constraints

### 10.1 Unchanged

- React 18 + TypeScript + Vite
- Radix UI primitives (只改样式层，不换组件库)
- Zustand + React Query
- React Hook Form + Zod
- Framer Motion (继续用于 layout animations / AnimatePresence)
- Feature-based directory structure
- i18n system
- **Backend: 零改动**

### 10.2 New Dependencies

```json
{
  "@fontsource-variable/jetbrains-mono": "^5.x"
}
```

仅此一个新依赖。无需 Departure Mono (license 不明确)、无需 Canvas library。

### 10.3 Performance Budget

| Metric | Target |
|--------|--------|
| Lighthouse Performance | >= 90 |
| First Contentful Paint | < 1.2s |
| Font Loading | `font-display: swap`, no FOIT |
| ASCII Particles (if enabled) | 60fps, < 5ms per frame |
| Bundle Size Increase | < 50KB (font woff2 only) |

### 10.4 Compatibility

- 等宽字体 fallback: `JetBrains Mono → Fira Code → SF Mono → Cascadia Code → monospace`
- CSS 变量机制不变，暗/亮切换不受影响
- 移动端安全区域适配保留
- `prefers-reduced-motion` 全部新动画 respect

---

## Appendix A: Quick Visual Reference

```
 ┌─────────────────────────────────────────────────────┐
 │                                                     │
 │   Typography:  JetBrains Mono everywhere            │
 │   Primary:     ██ #22b8cf  (Cyan)                   │
 │   Accent:      ██ #f0a020  (Amber)                  │
 │   Terminal:    ██ #4ade80  (Green)                   │
 │   Surface-0:   ██ #0b0d10  (Background)             │
 │   Surface-1:   ██ #111419  (Card)                   │
 │   Surface-2:   ██ #1b1f27  (Raised)                 │
 │   Border:      ██ #242930  (1px lines)              │
 │   Text:        ██ #d5d8dd  (Primary text)           │
 │   Muted:       ██ #6e7582  (Secondary text)         │
 │   Radius:      6px (default) / 4px (tags)           │
 │   Shadows:     Minimal — glow only on hover         │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

## Appendix B: Auth Page — Mobile View

```
 ┌──────────────────────┐
 │  ┌──────────────────┐│
 │  │ S K L I N K      ││
 │  │ C H A T          ││
 │  │                  ││
 │  │ 匿名安全即时...   ││
 │  └──────────────────┘│
 │                      │
 │  ░ 注册账号           │
 │  ────────────────    │
 │                      │
 │  [注册]   [登录]      │
 │  ════     ────       │
 │                      │
 │  ┌──────────────────┐│
 │  │ >_ email         ││
 │  └──────────────────┘│
 │  ┌──────────────────┐│
 │  │ >_ password      ││
 │  └──────────────────┘│
 │  ┌──────────────────┐│
 │  │ >_ display_name  ││
 │  └──────────────────┘│
 │  ┌──────────────────┐│
 │  │ >_ interests     ││
 │  └──────────────────┘│
 │                      │
 │  [CAPTCHA]           │
 │                      │
 │  ┌══════════════════┐│
 │  │   [ CONNECT ]    ││
 │  └══════════════════┘│
 │                      │
 │  已有账号? LOGIN      │
 │                      │
 └──────────────────────┘
```

## Appendix C: Chat View — Desktop

```
 ┌───────────┬──────────────────────────────────────────┐
 │ WORKSPACE │  [≡] ● 42  │ stranger_42 · 在线  │ [⟳] │
 │ ────────  ├──────────────────────────────────────────┤
 │           │                                          │
 │ ┌───────┐ │  stranger_42                       14:23 │
 │ │PROFILE│ │  ┌────────────────────────────┐          │
 │ │───────│ │  │  你好，在干嘛？              │          │
 │ │ name  │ │  └────────────────────────────┘          │
 │ │ ID:xx │ │                                          │
 │ │       │ │                                    14:24 │
 │ │[MUSIC]│ │       ┌────────────────────────────────┐ │
 │ │[CODE] │ │       │  嘿，刚下班，你呢？              │ │
 │ │       │ │       └────────────────────────────────┘ │
 │ │[SET]  │ │                                          │
 │ │[EXIT] │ │  >_ system: stranger 已加入        14:20 │
 │ └───────┘ │                                          │
 │           │                                          │
 │ ┌───────┐ ├──────────────────────────────────────────┤
 │ │PARTNER│ │  >_ 输入消息...                   [SEND] │
 │ │───────│ └──────────────────────────────────────────┘
 │ │ ...   │
 │ └───────┘
 └───────────┘
```
