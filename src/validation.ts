import { FeedbackRequest, VALID_CATEGORIES, Category } from "./types.js";

// バリデーションエラー
export interface ValidationError {
  field: string;
  message: string;
}

// リクエストボディのバリデーション
export function validateFeedbackRequest(
  body: unknown
): { valid: true; data: FeedbackRequest } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: [{ field: "body", message: "リクエストボディが不正です" }] };
  }

  const data = body as Record<string, unknown>;

  // 必須フィールドチェック
  if (!data.repo || typeof data.repo !== "string") {
    errors.push({ field: "repo", message: "repo は必須です（例: owner/repo）" });
  } else if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(data.repo)) {
    errors.push({ field: "repo", message: "repo の形式が不正です（owner/repo 形式で指定してください）" });
  }

  if (!data.title || typeof data.title !== "string") {
    errors.push({ field: "title", message: "title は必須です" });
  } else if (data.title.length > 256) {
    errors.push({ field: "title", message: "title は256文字以内にしてください" });
  }

  if (!data.body || typeof data.body !== "string") {
    errors.push({ field: "body", message: "body は必須です" });
  }

  if (!data.category || typeof data.category !== "string") {
    errors.push({ field: "category", message: "category は必須です" });
  } else if (!VALID_CATEGORIES.includes(data.category as Category)) {
    errors.push({
      field: "category",
      message: `category は次のいずれかを指定してください: ${VALID_CATEGORIES.join(", ")}`,
    });
  }

  // 任意フィールドの型チェック
  if (data.screenshot_base64 !== undefined && typeof data.screenshot_base64 !== "string") {
    errors.push({ field: "screenshot_base64", message: "screenshot_base64 は文字列で指定してください" });
  }

  if (data.screenshot_filename !== undefined && typeof data.screenshot_filename !== "string") {
    errors.push({ field: "screenshot_filename", message: "screenshot_filename は文字列で指定してください" });
  }

  if (data.metadata !== undefined && typeof data.metadata !== "object") {
    errors.push({ field: "metadata", message: "metadata はオブジェクトで指定してください" });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: data as unknown as FeedbackRequest };
}
