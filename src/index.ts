import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { authMiddleware, isAllowedRepo } from "./auth.js";
import { validateFeedbackRequest } from "./validation.js";
import { createIssue } from "./github.js";
import type { FeedbackResponse } from "./types.js";

const app = new Hono();

// ヘルスチェック
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Issue 作成エンドポイント（認証ミドルウェア付き）
app.post("/api/issues", authMiddleware, async (c) => {
  try {
    // リクエストボディをパース
    const body = await c.req.json();

    // バリデーション
    const result = validateFeedbackRequest(body);
    if (!result.valid) {
      return c.json<FeedbackResponse>(
        { success: false, error: result.errors.map((e) => e.message).join(", ") },
        400
      );
    }

    // リポジトリ許可チェック
    if (!isAllowedRepo(result.data.repo)) {
      return c.json<FeedbackResponse>(
        { success: false, error: `リポジトリ "${result.data.repo}" は許可されていません` },
        403
      );
    }

    // GitHub Issue を作成
    const { issueNumber, issueUrl } = await createIssue(result.data);

    return c.json<FeedbackResponse>(
      {
        success: true,
        issue_number: issueNumber,
        issue_url: issueUrl,
      },
      201
    );
  } catch (error) {
    console.error("Issue 作成エラー:", error);
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    return c.json<FeedbackResponse>({ success: false, error: message }, 500);
  }
});

// サーバー起動
const port = Number(process.env.PORT) || 3000;
console.log(`フィードバック API サーバーを起動中... ポート: ${port}`);

serve({
  fetch: app.fetch,
  port,
});
