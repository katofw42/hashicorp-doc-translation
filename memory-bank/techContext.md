# HashiCorp Docs 翻訳ツール - 技術コンテキスト

## 使用技術

### コア技術

1. **TypeScript/Node.js**
   - バージョン: Node.js v16以上を推奨
   - 型安全性と最新のJavaScript機能を活用
   - 非同期処理を効率的に扱うためのasync/await構文を活用

2. **Playwright**
   - バージョン: 最新の安定版
   - ヘッドレスブラウザを使用してウェブページにアクセス
   - DOMセレクタを使用してコンテンツを抽出
   - JavaScript実行後のコンテンツを取得可能

3. **OpenRouter API**
   - 様々なLLMモデルにアクセスするためのゲートウェイ
   - デフォルトモデル: `openai/gpt-3.5-turbo`
   - 環境変数で他のモデルを指定可能（例: `anthropic/claude-3-haiku`, `google/gemini-flash-1.5`）
   - チャット完了APIエンドポイントを使用

4. **axios**
   - HTTP通信ライブラリ
   - OpenRouter APIへのリクエスト送信に使用
   - タイムアウト設定やヘッダー管理に活用

5. **dotenv**
   - 環境変数管理ライブラリ
   - APIキーやモデル名などの設定を`.env`ファイルから読み込み

6. **Node.js標準ライブラリ**
   - `fs`: ファイル操作（読み込み、書き込み、ディレクトリ作成）
   - `path`: パス操作（結合、ディレクトリ名取得）
   - `URL`: URL解析

## 開発環境

1. **推奨IDE**
   - Visual Studio Code
   - TypeScript言語サポート
   - ESLint/Prettier拡張機能（オプション）

2. **ビルドツール**
   - `ts-node`: TypeScriptファイルを直接実行
   - `tsc`: TypeScriptコンパイラ（必要に応じてJSにコンパイル）

3. **パッケージ管理**
   - npm: 依存関係管理
   - package.json: スクリプト定義、依存関係リスト

4. **実行環境**
   - ローカル開発マシン
   - Node.js実行環境
   - インターネット接続（OpenRouter APIとHashiCorpドキュメントサイトにアクセスするため）

## 技術的制約

1. **OpenRouter API制限**
   - トークン制限: モデルによって異なる（通常は4K〜32Kトークン）
   - レート制限: APIキーによって異なる
   - コスト: 使用量に応じた課金
   - レスポンス時間: 大きなコンテンツの処理には時間がかかる（最大3分のタイムアウト設定）

2. **Playwrightの制約**
   - 初回実行時にブラウザバイナリのダウンロードが必要
   - メモリ使用量: ブラウザインスタンスはメモリを消費
   - ウェブサイト構造への依存: `#main`セレクタが変更された場合は調整が必要

3. **ファイルシステムの制約**
   - ファイル名の長さと文字制限: OSによって異なる
   - ディレクトリ階層の深さ制限: OSによって異なる
   - ファイルパーミッション: 書き込み権限が必要

4. **ネットワーク制約**
   - インターネット接続が必要
   - ファイアウォールやプロキシ設定によるアクセス制限の可能性
   - ネットワーク遅延: タイムアウト設定で対応（現在は3秒）

## 依存関係

### 直接的な依存関係

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "playwright": "^1.40.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.2.2"
  }
}
```

### 間接的な依存関係

- Playwrightのブラウザエンジン（Chromium）
- Node.js標準ライブラリ
- TypeScriptの型定義ファイル

## ツール使用パターン

### 1. 環境変数の使用

```typescript
// .envファイルから環境変数をロード
dotenv.config();

// 環境変数を取得（デフォルト値を設定）
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = process.env.OPENROUTER_MODEL_NAME || 'openai/gpt-3.5-turbo';
const HTML_TO_ENGLISH_PROMPT_FILE_PATH = process.env.HTML_TO_ENGLISH_PROMPT_FILE_PATH || 'prompts/html_to_english_markdown.txt';
```

### 2. ファイル読み込みパターン

```typescript
function loadFileContent(filePath: string, errorMessage: string, fallbackContent: string = ""): string {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`${errorMessage}: File not found at ${fullPath}. Using fallback or empty content.`);
      return fallbackContent;
    }
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return fallbackContent;
  }
}
```

### 3. Playwrightの使用パターン

```typescript
// Chromiumブラウザを起動
const browser = await chromium.launch();
// 新しいブラウザコンテキストを作成
const context = await browser.newContext();

// 各URLに対して処理
for (const url of urls) {
  // 新しいページを作成
  const page = await context.newPage();
  // 指定されたURLに移動
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 3000 });
  // ページ内から要素を取得
  const mainContentElement = await page.$('#main');
  // 要素のHTMLコンテンツを取得
  const htmlContent = await mainContentElement.innerHTML();
  // ページを閉じる
  await page.close();
}

// ブラウザを閉じる
await browser.close();
```

### 4. OpenRouter APIの使用パターン

```typescript
async function processTextWithOpenRouter(prompt: string, content: string, taskDescription: string): Promise<string> {
  // OpenRouter APIにリクエスト
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: OPENROUTER_MODEL_NAME,
      messages: [{ role: "user", content: fullPrompt }],
    },
    {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 180000
    }
  );
  
  return response.data.choices[0].message.content.trim();
}
```

## 技術的な決定とトレードオフ

### 1. Playwrightの選択
- **決定**: ウェブページアクセスにPlaywrightを使用
- **代替案**: axios/fetchでの直接HTTPリクエスト、Puppeteer、Selenium
- **理由**: JavaScriptレンダリングのサポート、シンプルなAPI、クロスブラウザサポート
- **トレードオフ**: 初期設定の複雑さとメモリ使用量の増加

### 2. OpenRouter APIの使用
- **決定**: 直接のLLM APIではなくOpenRouter APIを使用
- **代替案**: OpenAI API、Anthropic API、Google AI APIなどの直接使用
- **理由**: 複数のモデルへの統一アクセス、モデル切り替えの容易さ
- **トレードオフ**: 追加のレイヤーによる潜在的な遅延、依存関係の増加

### 3. 2段階処理（HTML→英語Markdown→日本語）
- **決定**: HTMLを直接日本語Markdownに変換せず、英語Markdownを中間ステップとして使用
- **代替案**: HTMLから直接日本語Markdownへの変換
- **理由**: 処理の分離による品質向上、原文の保存と参照が可能
- **トレードオフ**: 処理時間の増加、APIコールの増加

### 4. ファイル構造の維持
- **決定**: URLのパス構造をファイルシステムの構造として反映
- **代替案**: フラットなファイル構造、データベース保存
- **理由**: 元のドキュメント構造の保持、関連ファイルのグループ化
- **トレードオフ**: 複雑なパス処理、潜在的なファイルシステムの制限

### 5. 見出しベースの分割戦略
- **決定**: コンテンツを見出し（H1, H2）に基づいて分割
- **代替案**: 固定サイズの分割、文単位の分割
- **理由**: 論理的な構造の保持、翻訳品質の向上
- **トレードオフ**: 実装の複雑さ、見出しがない場合の対応
