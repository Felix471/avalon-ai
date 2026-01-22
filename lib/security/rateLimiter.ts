/**
 * 简易速率限制器 - 防止 API 滥用
 *
 * 在生产环境中，建议使用 Redis 等持久化存储
 * 这里使用内存存储作为演示
 */

// ==================== 类型定义 ====================

interface RateLimitEntry {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
}

interface RateLimitConfig {
  windowMs: number;      // 时间窗口（毫秒）
  maxRequests: number;   // 窗口内最大请求数
}

// ==================== 配置 ====================

// 不同操作的速率限制配置
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // 发言：每分钟最多 10 次
  discussion: { windowMs: 60 * 1000, maxRequests: 10 },

  // 投票：每分钟最多 20 次
  voting: { windowMs: 60 * 1000, maxRequests: 20 },

  // 任务执行：每分钟最多 15 次
  quest: { windowMs: 60 * 1000, maxRequests: 15 },

  // 组队：每分钟最多 10 次
  team_building: { windowMs: 60 * 1000, maxRequests: 10 },

  // 全局限制：每分钟最多 60 次 API 调用
  global: { windowMs: 60 * 1000, maxRequests: 60 },
};

// ==================== 内存存储 ====================

// 使用 Map 存储每个客户端的请求记录
// key 格式: `${clientId}:${action}`
const requestStore = new Map<string, RateLimitEntry>();

// 定期清理过期记录（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestStore.entries()) {
    // 如果记录超过 10 分钟没有更新，删除它
    if (now - entry.lastRequestTime > 10 * 60 * 1000) {
      requestStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ==================== 核心函数 ====================

/**
 * 检查是否超过速率限制
 *
 * @param clientId - 客户端标识（可以是 IP、session ID 等）
 * @param action - 操作类型
 * @returns 是否允许请求
 */
export function checkRateLimit(clientId: string, action: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number; // 毫秒后重置
} {
  const config = RATE_LIMIT_CONFIGS[action] || RATE_LIMIT_CONFIGS.global;
  const key = `${clientId}:${action}`;
  const now = Date.now();

  let entry = requestStore.get(key);

  // 如果没有记录，或者已经过了时间窗口，创建新记录
  if (!entry || now - entry.firstRequestTime > config.windowMs) {
    entry = {
      count: 1,
      firstRequestTime: now,
      lastRequestTime: now,
    };
    requestStore.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  // 检查是否超过限制
  if (entry.count >= config.maxRequests) {
    const resetIn = config.windowMs - (now - entry.firstRequestTime);
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.max(0, resetIn),
    };
  }

  // 增加计数
  entry.count++;
  entry.lastRequestTime = now;
  requestStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: config.windowMs - (now - entry.firstRequestTime),
  };
}

/**
 * 获取客户端 ID（从请求头中提取）
 * 在生产环境中，应该使用更可靠的方法
 */
export function getClientId(request: Request): string {
  // 优先使用 X-Forwarded-For（代理场景）
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // 其次使用 X-Real-IP
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // 最后使用一个默认值（不推荐）
  return 'unknown-client';
}

/**
 * 重置特定客户端的速率限制（用于测试）
 */
export function resetRateLimit(clientId: string, action?: string): void {
  if (action) {
    requestStore.delete(`${clientId}:${action}`);
  } else {
    // 删除该客户端的所有记录
    for (const key of requestStore.keys()) {
      if (key.startsWith(`${clientId}:`)) {
        requestStore.delete(key);
      }
    }
  }
}