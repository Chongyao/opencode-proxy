/**
 * 手动测试脚本 - 验证 opencode-proxy 插件功能
 */

import { loadConfig, getProxyForProvider, shouldUseProxy, validateConfig } from './dist/config.js';

console.log('═══════════════════════════════════════════════════════════');
console.log('  opencode-proxy v1.1.0 手动测试');
console.log('═══════════════════════════════════════════════════════════\n');

// 测试 1: 加载配置
console.log('📋 测试 1: 加载配置文件');
const config = loadConfig();
if (config) {
  console.log('✅ 配置加载成功');
  console.log('  - Debug 模式:', config.debug ? '开启' : '关闭');
  console.log('  - 提供商数量:', config.providers?.length || 0);
  console.log('  - 直连列表:', config.direct?.join(', ') || '无');
} else {
  console.log('❌ 配置加载失败');
}
console.log('');

// 测试 2: 验证配置
console.log('📋 测试 2: 验证配置格式');
const isValid = validateConfig(config);
console.log(isValid ? '✅ 配置格式正确' : '❌ 配置格式错误');
console.log('');

// 测试 3: 获取提供商代理配置
console.log('📋 测试 3: 获取各提供商代理配置');
const providers = ['google', 'anthropic', 'openai', 'moonshot', 'kimi', 'deepseek'];
for (const provider of providers) {
  const proxyConfig = getProxyForProvider(config, provider);
  if (proxyConfig) {
    if (proxyConfig.protocol === 'direct') {
      console.log(`  ${provider}: 🔄 直连`);
    } else {
      const auth = proxyConfig.username ? ` (${proxyConfig.username})` : '';
      console.log(`  ${provider}: 🔗 ${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}${auth}`);
    }
  } else {
    console.log(`  ${provider}: ⚪ 无配置（使用默认）`);
  }
}
console.log('');

// 测试 4: 环境变量配置
console.log('📋 测试 4: 环境变量配置支持');
console.log('  支持的环境变量:');
console.log('  - OPENCODE_PROXY_DEFAULT: 默认代理');
console.log('  - OPENCODE_PROXY_<PROVIDER>: 特定提供商代理');
console.log('  - OPENCODE_PROXY_DIRECT: 直连提供商列表');
console.log('  - OPENCODE_PROXY_DEBUG: 调试模式');
console.log('  - OPENCODE_PROXY_TIMEOUT: 超时设置');
console.log('');

// 测试 5: 检查是否需要代理
console.log('📋 测试 5: 代理启用状态');
const needProxy = shouldUseProxy(config);
console.log(needProxy ? '✅ 代理功能已启用' : '⚪ 代理功能未启用');
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('  测试完成！');
console.log('═══════════════════════════════════════════════════════════');
