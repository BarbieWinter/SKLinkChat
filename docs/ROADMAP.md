# Roadmap / 路线图

This roadmap describes the public direction of SKLinkChat. Priorities may change based on real user feedback.

这份路线图描述 SKLinkChat 的公开版本方向。优先级会随着真实使用反馈调整。

## v0.1.0 / 已完成

- React + Vite 前端应用
- FastAPI 后端服务
- PostgreSQL 数据模型和迁移
- Redis 会话、匹配和在线状态支持
- Stack Auth 登录链路
- 匿名实时聊天
- 举报提交
- 管理后台举报审核
- 管理后台审计日志
- Docker Compose 本地启动
- MIT License
- 开源贡献、安全和变更文档

## v0.2.0 / 开源展示增强 / 2026 Q2

- 游客体验模式：不登录也能浏览主要 UI，但不能真正聊天
- 本地演示数据模式：模拟聊天、举报和管理后台数据
- README 和截图继续补充真实页面截图
- GitHub Release 发布流程整理
- 目标：新用户 10 分钟内完成本地预览

## v0.3.0 / 治理能力增强 / 2026 Q3

- 账号治理增强：封禁原因、限制到期时间、管理员备注
- 用户申诉入口
- 基础敏感词过滤
- 管理后台筛选和批量处理
- 目标：管理员能完整追踪一次举报处理链路

## v0.4.0 / 体验与质量 / 2026 Q4

- 聊天体验增强：正在输入提示、对方离开提示、重新匹配按钮
- 消息发送失败重试
- 公开基础测试覆盖率或测试报告
- 更多端到端验证脚本
- 生产部署示例继续完善
- 目标：核心聊天链路具备可重复验证流程

## Backlog / 待评估

- 在线托管演示站
- 多语言 UI
- 更细粒度的权限模型
- 更完整的可观测性面板
