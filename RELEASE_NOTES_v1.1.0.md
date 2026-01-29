# Release Notes v1.1.0

## 🎉 版本发布

**版本**: v1.1.0  
**发布日期**: 2026-01-29  
**提交**: a31a57d

---

## ✨ 新功能

### 1. 环境变量配置支持
可以通过环境变量快速配置代理，无需修改配置文件：

```bash
# 默认代理
export OPENCODE_PROXY_DEFAULT="socks5://127.0.0.1:1080"

# 特定提供商代理
export OPENCODE_PROXY_GOOGLE="http://127.0.0.1:20171"
export OPENCODE_PROXY_ANTHROPIC="http://user:pass@proxy.example.com:8080"

# 直连提供商列表
export OPENCODE_PROXY_DIRECT="moonshot,kimi,groq"

# 调试模式
export OPENCODE_PROXY_DEBUG="true"
```

### 2. 配置热重载
在调试模式下，修改 `proxy.json` 会自动生效，无需重启 OpenCode。

### 3. 完整测试套件
- 23 个单元测试覆盖核心功能
- 使用 Vitest 测试框架
- 支持代码覆盖率报告

### 4. CI/CD 自动化
- GitHub Actions 自动测试（Node.js 18/20/22）
- 自动发布到 npm
- 自动创建 GitHub Release

### 5. 代码规范
- ESLint + Prettier 配置
- 自动代码格式化和检查

---

## 🔧 改进

### 1. 修复循环依赖
删除了 `package.json` 中引用自身的依赖项。

### 2. 实现 `direct` 字段
配置文件中的 `direct` 字段现在可以正常使用，列出的提供商将直连不走代理。

### 3. URL 匹配性能优化
- 预编译 URL 匹配规则
- O(n×m) 优化到 O(1) 查找
- 配置变化时自动重新编译

### 4. 清理遗留文件
删除了 `dist` 目录中的旧文件（proxy.js, proxy.d.ts）。

---

## 📦 文件变更

```
13 files changed, 5994 insertions(+), 188 deletions(-)

新增:
- .github/workflows/ci.yml
- .prettierignore
- .prettierrc
- eslint.config.js
- tests/config.test.ts
- vitest.config.ts
- RELEASE_NOTES_v1.1.0.md

修改:
- .github/workflows/release.yml
- README.md
- package-lock.json
- package.json
- src/config.ts
- src/index.ts
- src/types.ts
```

---

## 🚀 发布步骤

```bash
# 1. 推送代码
git push origin main

# 2. 推送标签（触发自动发布）
git push origin v1.1.0
```

推送标签后将自动：
1. 运行测试套件
2. 构建项目
3. 创建 GitHub Release
4. 发布到 npm

---

## 📚 文档更新

README 已更新，包含：
- 环境变量配置说明
- 新功能特性列表
- 环境变量配置示例
- Development 章节更新

---

## 🙏 鸣谢

感谢使用 opencode-proxy！
