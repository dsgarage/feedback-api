import type { Context, Next } from "hono";

// レート制限用のメモリストア
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// 期限切れエントリの定期クリーンアップ（5分ごと）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// API Key の検証
function isValidApiKey(apiKey: string | undefined): boolean {
  if (!apiKey) return false;

  const allowedKeys = (process.env.API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (allowedKeys.length === 0) {
    console.warn("警告: API_KEYS が設定されていません");
    return false;
  }

  return allowedKeys.includes(apiKey);
}

// リポジトリの許可チェック
export function isAllowedRepo(repo: string): boolean {
  const allowedRepos = (process.env.ALLOWED_REPOS ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  if (allowedRepos.length === 0) {
    console.warn("警告: ALLOWED_REPOS が設定されていません");
    return false;
  }

  return allowedRepos.includes(repo);
}

// レート制限チェック（IP + API Key で 1分10リクエスト）
function checkRateLimit(ip: string, apiKey: string): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `${ip}:${apiKey}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1分
  const maxRequests = 10;

  let entry = rateLimitStore.get(key);

  // ウィンドウがリセットされた、もしくは初回
  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1, resetAt: entry.resetAt };
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// 認証ミドルウェア
export async function authMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header("X-API-Key");

  // API Key 検証
  if (!isValidApiKey(apiKey)) {
    return c.json({ success: false, error: "無効な API Key です" }, 401);
  }

  // レート制限
  // X-Forwarded-For ヘッダーまたは接続元 IP を取得
  const ip = c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(ip, apiKey!);

  // レスポンスヘッダーにレート制限情報を追加
  c.header("X-RateLimit-Remaining", String(rateLimit.remaining));
  c.header("X-RateLimit-Reset", String(Math.ceil(rateLimit.resetAt / 1000)));

  if (!rateLimit.allowed) {
    return c.json(
      { success: false, error: "レート制限を超過しました。1分後にリトライしてください" },
      429
    );
  }

  await next();
}
