import { Octokit } from "@octokit/rest";
import {
  FeedbackRequest,
  CATEGORY_LABELS,
  LabelMapping,
  AppMetadata,
} from "./types.js";

// Octokit インスタンス（遅延初期化）
let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_PAT;
    if (!token) {
      throw new Error("GITHUB_PAT が設定されていません");
    }
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

// ラベルを確保（存在しなければ作成）
async function ensureLabel(
  owner: string,
  repo: string,
  label: LabelMapping
): Promise<void> {
  const client = getOctokit();
  try {
    await client.issues.getLabel({ owner, repo, name: label.name });
  } catch (error: unknown) {
    // ラベルが存在しない場合は作成
    if (isNotFoundError(error)) {
      await client.issues.createLabel({
        owner,
        repo,
        name: label.name,
        color: label.color,
      });
      console.log(`ラベル "${label.name}" を作成しました`);
    } else {
      throw error;
    }
  }
}

// 404 エラー判定
function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 404
  );
}

// スクリーンショットをリポジトリにアップロード
async function uploadScreenshot(
  owner: string,
  repo: string,
  base64Data: string,
  filename?: string
): Promise<string> {
  const client = getOctokit();

  // ファイル名を生成
  const timestamp = Date.now();
  const name = filename ?? `screenshot-${timestamp}.png`;
  const path = `.github/feedback-screenshots/${name}`;

  // Contents API でファイルをアップロード
  const response = await client.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `フィードバック: スクリーンショットを追加 (${name})`,
    content: base64Data,
    branch: await getDefaultBranch(owner, repo),
  });

  // ダウンロード URL を返す
  const downloadUrl = response.data.content?.download_url;
  if (!downloadUrl) {
    // フォールバック: raw URL を構築
    return `https://raw.githubusercontent.com/${owner}/${repo}/${await getDefaultBranch(owner, repo)}/${path}`;
  }
  return downloadUrl;
}

// デフォルトブランチを取得
async function getDefaultBranch(
  owner: string,
  repo: string
): Promise<string> {
  const client = getOctokit();
  const { data } = await client.repos.get({ owner, repo });
  return data.default_branch;
}

// メタデータから環境情報テーブルを生成
function buildMetadataTable(metadata: AppMetadata): string {
  const rows: string[] = [];

  if (metadata.app_name || metadata.app_version) {
    const appInfo = [
      metadata.app_name ?? "不明",
      metadata.app_version ? `v${metadata.app_version}` : "",
      metadata.build ? `(Build ${metadata.build})` : "",
    ]
      .filter(Boolean)
      .join(" ");
    rows.push(`| アプリ | ${appInfo} |`);
  }

  if (metadata.device) {
    rows.push(`| デバイス | ${metadata.device} |`);
  }

  if (metadata.os_version) {
    rows.push(`| OS | ${metadata.os_version} |`);
  }

  if (metadata.locale) {
    rows.push(`| ロケール | ${metadata.locale} |`);
  }

  if (rows.length === 0) return "";

  return [
    "",
    "---",
    "## 環境情報",
    "| 項目 | 値 |",
    "|------|-----|",
    ...rows,
    "",
    "---",
    "*このIssueはアプリ内フィードバックから自動作成されました*",
  ].join("\n");
}

// GitHub Issue を作成
export async function createIssue(
  request: FeedbackRequest
): Promise<{ issueNumber: number; issueUrl: string }> {
  const client = getOctokit();
  const [owner, repo] = request.repo.split("/");

  // カテゴリに対応するラベルを取得
  const categoryLabel = CATEGORY_LABELS[request.category];
  const labels: string[] = [categoryLabel.name];

  // BETA_MODE の場合は [beta] ラベルも追加
  const betaMode = process.env.BETA_MODE === "true";
  if (betaMode) {
    labels.push("[beta]");
  }

  // ラベルを確保（存在しなければ作成）
  await ensureLabel(owner, repo, categoryLabel);
  if (betaMode) {
    await ensureLabel(owner, repo, { name: "[beta]", color: "e4e669" });
  }

  // Issue 本文を構築
  let body = request.body;

  // スクリーンショットがあればアップロードして埋め込み
  if (request.screenshot_base64) {
    try {
      const imageUrl = await uploadScreenshot(
        owner,
        repo,
        request.screenshot_base64,
        request.screenshot_filename
      );
      body += `\n\n### スクリーンショット\n![screenshot](${imageUrl})`;
    } catch (error) {
      console.error("スクリーンショットのアップロードに失敗:", error);
      body += "\n\n> ⚠️ スクリーンショットのアップロードに失敗しました";
    }
  }

  // メタデータがあれば環境情報テーブルを追記
  if (request.metadata) {
    body += buildMetadataTable(request.metadata);
  }

  // Issue を作成
  const { data: issue } = await client.issues.create({
    owner,
    repo,
    title: request.title,
    body,
    labels,
  });

  return {
    issueNumber: issue.number,
    issueUrl: issue.html_url,
  };
}
