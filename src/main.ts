// 必要なモジュールをインポート
import { chromium } from 'playwright'; // Playwrightのchromiumブラウザを使用
import * as fs from 'fs'; // ファイルシステム操作用
import * as path from 'path'; // パス操作用
import axios from 'axios'; // HTTPリクエスト用
import * as dotenv from 'dotenv'; // 環境変数読み込み用

// .envファイルから環境変数をロード
dotenv.config();

// OpenRouter APIキーとモデル名を環境変数から取得
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = process.env.OPENROUTER_MODEL_NAME || 'openai/gpt-3.5-turbo'; // デフォルトモデル
const HTML_TO_ENGLISH_PROMPT_FILE_PATH = process.env.HTML_TO_ENGLISH_PROMPT_FILE_PATH || 'prompts/html_to_english_markdown.txt';
const ENGLISH_TO_JAPANESE_PROMPT_FILE_PATH = process.env.ENGLISH_TO_JAPANESE_PROMPT_FILE_PATH || 'prompts/english_markdown_to_japanese.txt';
const DO_NOT_TRANSLATE_FILE_PATH = process.env.DO_NOT_TRANSLATE_FILE_PATH || 'dictionaries/do_not_translate.txt';

// ファイルの内容を読み込む汎用関数
function loadFileContent(filePath: string, errorMessage: string, fallbackContent: string = ""): string {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`${errorMessage}: ファイルが見つかりませんでした ${fullPath}。フォールバックまたは空のコンテンツを使用します。`);
      return fallbackContent;
    }
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return fallbackContent;
  }
}

// プロンプトテンプレートと翻訳禁止単語リストを読み込み
const htmlToEnglishPromptTemplate = loadFileContent(
  HTML_TO_ENGLISH_PROMPT_FILE_PATH,
  `Error loading HTML to English prompt template from ${HTML_TO_ENGLISH_PROMPT_FILE_PATH}`,
  "Convert the following HTML to GitHub Flavored Markdown: {html_content}"
);

const englishToJapanesePromptTemplate = loadFileContent(
  ENGLISH_TO_JAPANESE_PROMPT_FILE_PATH,
  `Error loading English to Japanese prompt template from ${ENGLISH_TO_JAPANESE_PROMPT_FILE_PATH}`,
  "Translate the following Markdown to Japanese: {markdown_content}"
);

const doNotTranslateWordsList = loadFileContent(
  DO_NOT_TRANSLATE_FILE_PATH,
  `Error loading do_not_translate list from ${DO_NOT_TRANSLATE_FILE_PATH}`
).split('\n').map(word => word.trim()).filter(word => word.length > 0);

const doNotTranslateSection = doNotTranslateWordsList.join('\n');

// デバッグログ出力用の関数
function appendDebugLog(logContent: string) {
  const logFilePath = path.join(process.cwd(), 'debug_translation.log');
  fs.appendFileSync(logFilePath, logContent + '\n---\n', 'utf-8');
}


// OpenRouter APIを使用してテキストを処理する汎用関数
async function processTextWithOpenRouter(prompt: string, content: string, taskDescription: string): Promise<string> {
  appendDebugLog(`タスク: ${taskDescription}`);
  appendDebugLog(`入力コンテンツ長: ${content.length}`);
  // appendDebugLog(`入力コンテンツ: ${content.substring(0, 500)}...`); // コンテンツの先頭のみログ出力

  if (!OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEYが設定されていません。OpenRouterでの処理をスキップします。');
    appendDebugLog('OPENROUTER_API_KEYが設定されていません。');
    return `OpenRouter API Key not set. Original content:\n${content}`;
  }

  // コンテンツが長すぎる場合の警告 (実際の制限はモデルやAPIによる)
  // プロンプトと合わせるとさらに長くなるため、コンテンツ自体の長さに注意
  if (content.length > 15000) { // 仮の制限値を少し厳しく
      console.warn(`${taskDescription} のコンテンツが非常に長いです (${content.length} 文字)。API制限を超えるか、時間がかかる可能性があります。`);
      appendDebugLog(`警告: コンテンツが非常に長いです (${content.length} 文字)。`);
  }

  // プロンプトテンプレートにコンテンツを挿入
  const fullPrompt = prompt
    .replace('{html_content}', content)
    .replace('{markdown_content}', content)
    .replace('{do_not_translate_words}', doNotTranslateSection);

  // appendDebugLog(`Full Prompt: ${fullPrompt.substring(0, 500)}...`); // プロンプトの先頭のみログ出力
  appendDebugLog(`Full Prompt Length: ${fullPrompt.length}`);


  try {
    console.log(`Processing with OpenRouter: ${taskDescription}...`);
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: OPENROUTER_MODEL_NAME,
        messages: [
          { role: "user", content: fullPrompt }
        ],
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 180000 // APIのタイムアウトを3分に延長 (長文処理のため)
      }
    );

    // API応答の検証とログ出力
    appendDebugLog(`API Response Status: ${response.status}`);
    // appendDebugLog(`API Response Data: ${JSON.stringify(response.data, null, 2).substring(0, 500)}...`); // レスポンスデータの先頭のみログ出力

    if (response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
      const processedContent = response.data.choices[0].message.content.trim();
      console.log(`${taskDescription} 成功。処理済みコンテンツ長: ${processedContent.length}`);
      appendDebugLog(`${taskDescription} 成功。処理済みコンテンツ長: ${processedContent.length}`);
      // appendDebugLog(`処理済みコンテンツ: ${processedContent.substring(0, 500)}...`); // 処理済みコンテンツの先頭のみログ出力
      return processedContent;
    } else {
      console.error(`${taskDescription} 失敗: APIからの応答なし、または予期しない形式です。応答データ:`, JSON.stringify(response.data, null, 2));
      appendDebugLog(`${taskDescription} 失敗: APIからの応答なし、または予期しない形式です。`);
      appendDebugLog(`応答データ: ${JSON.stringify(response.data, null, 2)}`);
      // 応答が空または不適切な場合は元のコンテンツを返す
      return `Processing failed for ${taskDescription}. Original content:\n${content}`;
    }
  } catch (error: any) {
    console.error(`${taskDescription} の実行中にエラーが発生しました (OpenRouter):`, error.response ? error.response.data : error.message);
    appendDebugLog(`${taskDescription} の実行中にエラーが発生しました (OpenRouter): ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    // エラー発生時も元のコンテンツを返す
    return `Error during processing for ${taskDescription}. Original content:\n${content}`;
  }
}

// HTMLコンテンツを英語Markdownに変換する関数
async function convertHtmlToEnglishMarkdown(htmlContent: string): Promise<string> {
    return processTextWithOpenRouter(htmlToEnglishPromptTemplate, htmlContent, 'HTML to English Markdown Conversion');
}

// 見出しベースでMarkdownコンテンツを分割する関数
function splitMarkdownByHeadings(markdown: string, maxChunkSize: number = 5000): string[] {
  const chunks: string[] = [];
  let currentPosition = 0;

  // H1, H2, H3, H4, H5, H6 見出しの正規表現
  const headingPattern = /^(#+ .+)$/m;

  while (currentPosition < markdown.length) {
    // 現在位置から次の見出しを検索
    let nextHeadingMatch = markdown.substring(currentPosition).match(headingPattern);
    let nextHeadingIndex = nextHeadingMatch ? currentPosition + nextHeadingMatch.index! : markdown.length;

    // 現在のチャンクの終了位置を決定 (最大チャンクサイズまたは次の見出しの直前)
    let chunkEnd = Math.min(currentPosition + maxChunkSize, nextHeadingIndex);

    // チャンクを抽出
    let chunk = markdown.substring(currentPosition, chunkEnd).trim();

    // チャンクが空でなく、かつ次の見出しの直前でチャンクが終わる場合、
    // チャンクの末尾を見出しの直前の改行に調整して見出しを含めないようにする
    if (chunk.length > 0 && chunkEnd < markdown.length && chunkEnd === nextHeadingIndex) {
         const lastNewlineBeforeHeading = markdown.lastIndexOf('\n', nextHeadingIndex - 1);
         if (lastNewlineBeforeHeading > currentPosition) {
             chunkEnd = lastNewlineBeforeHeading;
             chunk = markdown.substring(currentPosition, chunkEnd).trim();
         }
    }

    // チャンクを追加
    if (chunk.length > 0) {
      chunks.push(chunk);
      currentPosition = chunkEnd;
    } else {
        // 空のチャンクができた場合は、次の見出しの直後に移動して無限ループを防ぐ
        currentPosition = nextHeadingIndex > currentPosition ? nextHeadingIndex : currentPosition + 1;
    }

     // 次のチャンクの開始位置を調整（連続する改行や空白をスキップ）
     while (currentPosition < markdown.length && /\s/.test(markdown[currentPosition])) {
         currentPosition++;
     }
  }

  // チャンクが一つも生成されなかった場合は、元のMarkdown全体を一つのチャンクとして返す
  if (chunks.length === 0 && markdown.trim().length > 0) {
      chunks.push(markdown.trim());
  }

  return chunks;
}


// 英語Markdownを日本語に翻訳する関数
async function translateEnglishMarkdownToJapanese(markdownContent: string): Promise<string> {
  appendDebugLog(`--- Starting Japanese Translation ---`);
  appendDebugLog(`Input Markdown Content Length: ${markdownContent.length}`);
  // appendDebugLog(`Input Markdown Content: ${markdownContent.substring(0, 500)}...`); // コンテンツの先頭のみログ出力

  // テスト用の単純なテキストで翻訳を試すオプション (必要に応じてコメント解除)
  // const testChunk = "This is a test sentence.";
  // console.log(`Translating test chunk: "${testChunk}"`);
  // const translatedTestChunk = await processTextWithOpenRouter(
  //   englishToJapanesePromptTemplate,
  //   testChunk,
  //   `English Markdown to Japanese Translation (Test Chunk)`
  // );
  // console.log(`Translated test chunk: "${translatedTestChunk}"`);
  // appendDebugLog(`Translated test chunk: "${translatedTestChunk}"`);
  // return translatedTestChunk; // テスト結果のみを返す場合はここで終了

  // 見出しベースで分割（最大5000文字）
  const chunks = splitMarkdownByHeadings(markdownContent, 5000);
  appendDebugLog(`Split into ${chunks.length} chunks.`);
  // appendDebugLog(`Chunks: ${JSON.stringify(chunks.map(c => c.substring(0, 100) + '...'))}`); // 各チャンクの先頭のみログ出力

  let translatedContent = '';
  
  // 各チャンクを順次翻訳
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`チャンク ${i + 1}/${chunks.length} を翻訳中 (${chunk.length} 文字)...`);
    appendDebugLog(`--- チャンク ${i + 1}/${chunks.length} を翻訳中 ---`);
    appendDebugLog(`チャンク長: ${chunk.length}`);
    // appendDebugLog(`チャンクコンテンツ: ${chunk.substring(0, 500)}...`); // チャンクコンテンツの先頭のみログ出力

    //APIリクエストの詳細をログ出力 (オプション)
    // console.log(`API Request for chunk ${i + 1}:`, englishToJapanesePromptTemplate.replace('{markdown_content}', chunk).replace('{do_not_translate_words}', doNotTranslateSection));
    // appendDebugLog(`API Request for chunk ${i + 1}: ${englishToJapanesePromptTemplate.replace('{markdown_content}', chunk).replace('{do_not_translate_words}', doNotTranslateSection).substring(0, 500)}...`); // リクエストの先頭のみログ出力


    const translatedChunk = await processTextWithOpenRouter(
      englishToJapanesePromptTemplate, 
      chunk, 
      `English Markdown to Japanese Translation (Chunk ${i + 1}/${chunks.length})`
    );
    
    // 翻訳結果の長さをログ出力
    console.log(`翻訳済みチャンク ${i + 1}/${chunks.length} 長さ: ${translatedChunk.length}`);
    appendDebugLog(`翻訳済みチャンク ${i + 1}/${chunks.length} 長さ: ${translatedChunk.length}`);
    // appendDebugLog(`翻訳済みチャンクコンテンツ: ${translatedChunk.substring(0, 500)}...`); // 翻訳済みチャンクの先頭のみログ出力


    // 翻訳結果を結合
    if (translatedContent.length > 0) {
      translatedContent += '\n\n' + translatedChunk;
    } else {
      translatedContent = translatedChunk;
    }
    appendDebugLog(`Current combined translated content length: ${translatedContent.length}`);
  }
  
  appendDebugLog(`--- Finished Japanese Translation ---`);
  appendDebugLog(`Final Translated Content Length: ${translatedContent.length}`);
  // appendDebugLog(`Final Translated Content: ${translatedContent.substring(0, 500)}...`); // 最終結果の先頭のみログ出力

  return translatedContent;
}


// メイン処理を行う非同期関数
async function main() {
  // URLリストが記載されたファイルのパスを指定
  const urlsFilePath = path.join(process.cwd(), 'output/vault-urls.txt');
  // ファイルを読み込み、改行で分割してURLの配列を生成 (空行は除外)
  const urls = fs.readFileSync(urlsFilePath, 'utf-8').split('\n').filter(url => url.trim() !== '');

  // Chromiumブラウザを起動
  const browser = await chromium.launch();
  // 新しいブラウザコンテキストを作成
  const context = await browser.newContext();

  // 出力ディレクトリのパスを定義
  const outputDir = path.join(process.cwd(), 'markdown_output');
  const originalOutputDir = path.join(outputDir, 'original');

  // 出力ディレクトリが存在しない場合は作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  // 原文出力ディレクトリが存在しない場合は作成
  if (!fs.existsSync(originalOutputDir)) {
    fs.mkdirSync(originalOutputDir, { recursive: true });
  }


  // URLリストの各URLに対して処理を実行
  for (const url of urls) {
    try {
      // 新しいページを作成
      const page = await context.newPage();
      console.log(`${url} に移動中...`); // 現在処理中のURLをログに出力
      // 指定されたURLに移動 (DOMContentLoadedイベントが発生するか、3秒のタイムアウトまで待機)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 3000 });

      // ページ内から id="main" の要素を取得
      const mainContentElement = await page.$('#main');

      // 要素が見つかった場合
      if (mainContentElement) {
        // 要素のHTMLコンテンツを取得
        const htmlContent = await mainContentElement.innerHTML();

        // 段階 1: HTMLコンテンツをOpenRouterで英語Markdownに変換
        const englishMarkdown = await convertHtmlToEnglishMarkdown(htmlContent);

        // 変換結果が空でないかチェック
        if (!englishMarkdown || englishMarkdown.trim().length === 0) {
          console.warn(`${url} のHTMLから英語Markdownへの変換結果が空です。`);
          // 空の場合は処理をスキップするか、エラーとして扱うか検討
          // 今回は空のまま後続処理に進みますが、必要に応じて変更してください
        }

        // URLからパス部分を抽出
        const urlObject = new URL(url);
        let urlPath = urlObject.pathname; // 例: "/vault/docs/about-vault/what-is-vault"

        // パス部分から不要な接頭語を除去
        let relativePath = urlPath;
        if (relativePath.startsWith('/vault/docs/')) {
          relativePath = relativePath.substring('/vault/docs/'.length); // 例: "about-vault/what-is-vault"
        }

        // ファイル名として使用できる形式に変換 (スラッシュはそのまま、不適切な文字を置換)
        const baseFilename = relativePath.replace(/[^\w.\/-]/g, ''); // 例: "about-vault/what-is-vault"

        // ファイルパスを生成 (原文用サフィックスを追加)
        const originalFilename = baseFilename + '_original.md';
        const originalOutputFilePath = path.join(originalOutputDir, originalFilename);

        // ディレクトリが存在することを確認（親ディレクトリを再帰的に作成）
        fs.mkdirSync(path.dirname(originalOutputFilePath), { recursive: true });

        // 英語Markdownコンテンツをファイルに書き込み
        if (englishMarkdown && englishMarkdown.trim().length > 0) {
          fs.writeFileSync(originalOutputFilePath, englishMarkdown, 'utf-8');
          console.log(`原文Markdownコンテンツを ${originalOutputFilePath} に保存しました。`);
        } else {
          console.warn(`${url} の空の原文Markdownファイルの書き込みをスキップします。`);
        }


        // 段階 2: 英語MarkdownをOpenRouterで日本語に翻訳
        const japaneseMarkdown = await translateEnglishMarkdownToJapanese(englishMarkdown);

        // 翻訳結果が空でないかチェック
        if (!japaneseMarkdown || japaneseMarkdown.trim().length === 0) {
           console.warn(`${url} の英語から日本語への翻訳結果が空です。`);
           // 空の場合は処理をスキップするか、エラーとして扱うか検討
           // 今回は空のままファイル書き込みに進みますが、必要に応じて変更してください
        }

        // ファイルパスを生成 (日本語用サフィックスを追加)
        const japaneseFilename = baseFilename + '_ja.md';
        const japaneseOutputFilePath = path.join(outputDir, japaneseFilename);

        // ディレクトリが存在することを確認（親ディレクトリを再帰的に作成）
        fs.mkdirSync(path.dirname(japaneseOutputFilePath), { recursive: true });

        // 日本語Markdownコンテンツをファイルに書き込み
        if (japaneseMarkdown && japaneseMarkdown.trim().length > 0) {
          fs.writeFileSync(japaneseOutputFilePath, japaneseMarkdown, 'utf-8');
          console.log(`日本語Markdownコンテンツを ${japaneseOutputFilePath} に保存しました。`);
        } else {
          console.warn(`${url} の空の日本語Markdownファイルの書き込みをスキップします。`);
        }


      } else {
        // id="main" の要素が見つからなかった場合
        console.log(`${url} で #main 要素が見つかりませんでした。`);
      }
      // ページを閉じる
      await page.close();
    } catch (error) {
      // エラーが発生した場合の処理
      console.error(`${url} の処理中にエラーが発生しました:`, error);
    }
  }

  // ブラウザを閉じる
  await browser.close();
}

// main関数を実行し、エラーが発生した場合はコンソールに出力
main().catch((error) => {
  console.error("メイン実行中にエラーが発生しました:", error);
  appendDebugLog(`メイン実行中にエラーが発生しました: ${error.message}`);
});
