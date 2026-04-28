# Security Policy / 安全说明

## Supported Versions / 支持版本

The public repository currently supports the `main` branch only.

当前公开仓库只维护 `main` 分支。

## Reporting a Vulnerability / 报告漏洞

请不要把安全问题公开提交到 GitHub Issues。

If GitHub Security Advisories are enabled for this repository, use the private vulnerability reporting flow. If that option is unavailable, contact the maintainer privately before opening a public issue.

如果 GitHub Security Advisories 已启用，请使用私密漏洞报告流程。如果入口不可用，请先通过维护者的私密渠道联系，不要直接公开发 issue。

Please report privately if you find:

如果你发现以下问题，请私密报告：

- API key、数据库密码、私钥或访问 token 泄露
- 鉴权绕过
- 管理权限绕过
- WebSocket 会话串线
- 用户数据泄露
- 可导致服务不可用的漏洞

Please include:

报告中请尽量包含：

- 问题描述
- 影响范围
- 复现步骤
- 你观察到的实际结果
- 你认为安全的修复建议，如有

## Response Process / 处理流程

- Confirm whether the report is reproducible.
- Estimate impact and affected versions.
- Prepare a fix before public disclosure when possible.
- Update `CHANGELOG.md` or release notes after the fix is available.

维护者确认后会优先复现、评估影响范围、准备修复，并在修复完成后更新公开说明。
