// フィードバックのカテゴリ
export type Category =
  | "bug"
  | "crash"
  | "feature"
  | "ux"
  | "performance"
  | "question"
  | "other";

// カテゴリ → GitHub ラベルのマッピング定義
export interface LabelMapping {
  name: string;
  color: string;
}

// カテゴリとラベルの対応表
export const CATEGORY_LABELS: Record<Category, LabelMapping> = {
  bug: { name: "\u{1F41B} bug", color: "d73a4a" },
  crash: { name: "\u{1F4A5} crash", color: "b60205" },
  feature: { name: "\u2728 feature request", color: "0075ca" },
  ux: { name: "\u{1F4A1} ux improvement", color: "7057ff" },
  performance: { name: "\u26A1 performance", color: "fbca04" },
  question: { name: "\u2753 question", color: "d876e3" },
  other: { name: "\u{1F4DD} feedback", color: "cccccc" },
};

// 有効なカテゴリ一覧
export const VALID_CATEGORIES: Category[] = Object.keys(
  CATEGORY_LABELS
) as Category[];

// アプリから送信されるメタデータ
export interface AppMetadata {
  app_name?: string;
  app_version?: string;
  build?: string;
  device?: string;
  os_version?: string;
  locale?: string;
}

// フィードバックリクエストのボディ
export interface FeedbackRequest {
  // 対象リポジトリ（例: "dsgarage/TaktScore"）
  repo: string;
  // Issue タイトル
  title: string;
  // Issue 本文
  body: string;
  // カテゴリ
  category: Category;
  // スクリーンショット（base64 エンコード、任意）
  screenshot_base64?: string;
  // スクリーンショットのファイル名（任意）
  screenshot_filename?: string;
  // アプリのメタデータ（任意）
  metadata?: AppMetadata;
}

// API レスポンス
export interface FeedbackResponse {
  success: boolean;
  issue_number?: number;
  issue_url?: string;
  error?: string;
}
