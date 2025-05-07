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
      console.warn(`${errorMessage}: File not found at ${fullPath}. Using fallback or empty content.`);
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


// OpenRouter APIを使用してテキストを処理する汎用関数
async function processTextWithOpenRouter(prompt: string, content: string, taskDescription: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY is not set. Skipping processing with OpenRouter.');
    return `OpenRouter API Key not set. Original content:\n${content}`;
  }

  // コンテンツが長すぎる場合の警告 (実際の制限はモデルやAPIによる)
  // プロンプトと合わせるとさらに長くなるため、コンテンツ自体の長さに注意
  if (content.length > 20000) { // 仮の制限値
      console.warn(`Content for ${taskDescription} is very long (${content.length} characters). This might exceed API limits or take a long time.`);
  }

  // プロンプトテンプレートにコンテンツを挿入
  const fullPrompt = prompt.replace('{html_content}', content).replace('{markdown_content}', content).replace('{do_not_translate_words}', doNotTranslateSection);


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

    if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
      console.log(`${taskDescription} successful.`);
      return response.data.choices[0].message.content.trim();
    } else {
      console.error(`${taskDescription} failed: No response from API or unexpected format.`, response.data);
      return `Processing failed for ${taskDescription}. Original content:\n${content}`;
    }
  } catch (error: any) {
    console.error(`Error during ${taskDescription} with OpenRouter:`, error.response ? error.response.data : error.message);
    return `Error during processing for ${taskDescription}. Original content:\n${content}`;
  }
}

// HTMLコンテンツを英語Markdownに変換する関数
async function convertHtmlToEnglishMarkdown(htmlContent: string): Promise<string> {
    return processTextWithOpenRouter(htmlToEnglishPromptTemplate, htmlContent, 'HTML to English Markdown Conversion');
}

// 英語Markdownを日本語に翻訳する関数
async function translateEnglishMarkdownToJapanese(markdownContent: string): Promise<string> {
    return processTextWithOpenRouter(englishToJapanesePromptTemplate, markdownContent, 'English Markdown to Japanese Translation');
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
      console.log(`Navigating to ${url}...`); // 現在処理中のURLをログに出力
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

        // URLからファイル名を生成 (原文用サフィックスを追加)
        const urlParts = url.replace(/^https?:\/\//, '').split('/');
        const originalFilename = urlParts.join('-').replace(/[^\w.-]/g, '') + '_original.md';
        const originalOutputFilePath = path.join(originalOutputDir, originalFilename);

        // 英語Markdownコンテンツをファイルに書き込み
        fs.writeFileSync(originalOutputFilePath, englishMarkdown, 'utf-8');
        console.log(`Original Markdown content saved to ${originalOutputFilePath}`);

        // 段階 2: 英語MarkdownをOpenRouterで日本語に翻訳
        const japaneseMarkdown = await translateEnglishMarkdownToJapanese(englishMarkdown);

        // URLからファイル名を生成 (日本語用サフィックスを追加)
        const japaneseFilename = urlParts.join('-').replace(/[^\w.-]/g, '') + '_ja.md';
        const japaneseOutputFilePath = path.join(outputDir, japaneseFilename);

        // 日本語Markdownコンテンツをファイルに書き込み
        fs.writeFileSync(japaneseOutputFilePath, japaneseMarkdown, 'utf-8');
        console.log(`Japanese Markdown content saved to ${japaneseOutputFilePath}`);

      } else {
        // id="main" の要素が見つからなかった場合
        console.log(`Could not find #main element on ${url}`);
      }
      // ページを閉じる
      await page.close();
    } catch (error) {
      // エラーが発生した場合の処理
      console.error(`Error processing ${url}:`, error);
    }
  }

  // ブラウザを閉じる
  await browser.close();
}

// main関数を実行し、エラーが発生した場合はコンソールに出力
main().catch(console.error);
