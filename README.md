# HashiCorp Docs 翻訳ツール

このプロジェクトは、指定されたHashiCorpのドキュメントURLリストからHTMLコンテンツを取得し、OpenRouter APIを利用して以下の2段階の処理を行い、結果をファイルに保存するNode.jsスクリプトです。Playwrightを使用してウェブページにアクセスします。

1.  HTMLコンテンツを英語のGitHub Flavored Markdownに変換
2.  生成された英語のMarkdownを日本語に翻訳

## 特徴

-   複数のURLを一括で処理
-   各URLのメインコンテンツ（HTML）を抽出
-   OpenRouter APIを利用した2段階処理: HTML → 英語Markdown → 日本語Markdown
-   原文（英語）Markdownと日本語翻訳済みMarkdownを個別のファイルとして保存
-   出力ディレクトリ構造の整理 (`markdown_output/` と `markdown_output/original/`)
-   ファイル名はURLに基づいて自動生成
-   ユーザーがカスタマイズ可能なプロンプトファイルと翻訳禁止単語リストを外部から読み込み可能

## 前提条件

-   Node.js (v16以上を推奨)
-   npm (Node.jsに同梱)

## セットアップ手順

1.  リポジトリをクローンするか、ファイルをダウンロードします。
    ```bash
    git clone <リポジトリURL>
    cd <プロジェクトディレクトリ>
    ```

2.  必要な依存関係をインストールします。
    ```bash
    npm install
    ```

3.  **APIキーの設定（翻訳機能を利用する場合）:**
    OpenRouter APIを利用して翻訳機能を使用するには、APIキーの設定が必要です。
    プロジェクトのルートディレクトリに `.env` という名前のファイルを作成し、以下のように記述します。

    ```env
    OPENROUTER_API_KEY=あなたのOpenRouter_APIキー
    OPENROUTER_MODEL_NAME=使用するモデル名 (例: openai/gpt-3.5-turbo, anthropic/claude-3-haiku, google/gemini-flash-1.5)
    HTML_TO_ENGLISH_PROMPT_FILE_PATH=HTMLから英語Markdownへの変換プロンプトファイルのパス (例: prompts/my_html_to_en_prompt.txt)
    ENGLISH_TO_JAPANESE_PROMPT_FILE_PATH=英語Markdownから日本語への翻訳プロンプトファイルのパス (例: prompts/my_en_to_ja_prompt.txt)
    DO_NOT_TRANSLATE_FILE_PATH=翻訳禁止単語リストファイルのパス (例: dictionaries/my_custom_dictionary.txt)
    ```
    -   `あなたのOpenRouter_APIキー` を実際のAPIキーに置き換えてください。
    -   `OPENROUTER_MODEL_NAME` はオプションで、指定しない場合は `openai/gpt-3.5-turbo` がデフォルトで使用されます。OpenRouterで利用可能なモデル名を指定してください。
    -   `HTML_TO_ENGLISH_PROMPT_FILE_PATH` はオプションで、指定しない場合は `prompts/html_to_english_markdown.txt` がデフォルトで使用されます。独自のプロンプトを使用する場合は、この環境変数にファイルパスを指定してください。プロンプトファイル内では `{html_content}` というプレースホルダーを使用できます。
    -   `ENGLISH_TO_JAPANESE_PROMPT_FILE_PATH` はオプションで、指定しない場合は `prompts/english_markdown_to_japanese.txt` がデフォルトで使用されます。独自のプロンプトを使用する場合は、この環境変数にファイルパスを指定してください。プロンプトファイル内では `{markdown_content}` と `{do_not_translate_words}` というプレースホルダーを使用できます。
    -   `DO_NOT_TRANSLATE_FILE_PATH` はオプションで、指定しない場合は `dictionaries/do_not_translate.txt` がデフォルトで使用されます。このファイルには、翻訳せずにそのまま保持したい単語を1行に1つずつ記述します。
    -   `.env` ファイルは `.gitignore` によってリポジトリにはコミットされません。

## 使用方法

1.  プロジェクトルートの `output/vault-urls.txt` ファイルを作成または編集し、処理したいHashiCorpドキュメントのURLを1行に1つずつ記述します。

    例 (`output/vault-urls.txt`):
    ```
    https://developer.hashicorp.com/vault/docs/about-vault/what-is-vault
    https://developer.hashicorp.com/vault/docs/configuration/log-requests-level
    ```

2.  **プロンプトのカスタマイズ（オプション）:**
    -   **HTML → 英語Markdown変換プロンプト:** デフォルトは `prompts/html_to_english_markdown.txt` です。独自のプロンプトを使用したい場合は、新しいテキストファイルを作成し、そのパスを `.env` ファイルの `HTML_TO_ENGLISH_PROMPT_FILE_PATH` に設定します。プロンプト内では `{html_content}` というプレースホルダーを使用できます。
    -   **英語Markdown → 日本語翻訳プロンプト:** デフォルトは `prompts/english_markdown_to_japanese.txt` です。独自のプロンプトを使用したい場合は、新しいテキストファイルを作成し、そのパスを `.env` ファイルの `ENGLISH_TO_JAPANESE_PROMPT_FILE_PATH` に設定します。プロンプト内では `{markdown_content}`（英語Markdown用）および `{do_not_translate_words}`（翻訳禁止単語リスト用）というプレースホルダーを使用できます。

3.  **翻訳禁止単語リストのカスタマイズ（オプション）:**
    デフォルトの翻訳禁止単語リストは `dictionaries/do_not_translate.txt` にあります。
    このファイルに、翻訳せずにそのままの表記を維持したい単語やフレーズを1行に1つずつ記述します。
    独自のリストファイルを使用したい場合は、新しいテキストファイルを作成し、そのパスを `.env` ファイルの `DO_NOT_TRANSLATE_FILE_PATH` に設定します。

4.  以下のコマンドを実行してスクリプトを開始します。
    ```bash
    npm start
    ```

5.  スクリプトが完了すると、プロジェクトルートの `markdown_output` ディレクトリ内に以下の構造でファイルが保存されます。ファイル名から冗長な接頭語は削除されます。
    ```
    markdown_output/
    ├── [パス]-[ファイル名]_ja.md       # 日本語翻訳済みMarkdown
    └── original/
        └── [パス]-[ファイル名]_original.md # 原文（英語）Markdown
    ```

## プロジェクト構造

```
.
├── markdown_output/      # 生成されたMarkdownファイルが保存されるディレクトリ
├── node_modules/         # npmによってインストールされた依存関係
├── output/
│   └── vault-urls.txt    # 処理対象のURLリスト
├── src/
│   └── main.ts           # メインのTypeScriptスクリプト
├── prompts/
│   ├── html_to_english_markdown.txt # HTMLから英語Markdownへの変換プロンプト
│   └── english_markdown_to_japanese.txt # 英語Markdownから日本語への翻訳プロンプト
├── dictionaries/
│   └── do_not_translate.txt # デフォルトの翻訳禁止単語リストファイル
├── .gitignore
├── package-lock.json
├── package.json
├── README.md             # このファイル
└── tsconfig.json         # TypeScriptコンパイラ設定
```

## APIキーの安全な取り扱いについて

OpenRouter APIキーのような機密情報は、コードに直接書き込まず、環境変数を通じて管理することが推奨されます。このプロジェクトでは `dotenv` ライブラリを使用しています。

1.  **`.env` ファイル:** プロジェクトのルートに `.env` ファイルを作成し、`OPENROUTER_API_KEY=your_actual_api_key` のようにキーを保存します。
2.  **`.gitignore`:** `.env` ファイルは機密情報を含むため、Gitの追跡対象から除外します。`.gitignore` ファイルに `.env` を追加することで、誤ってリポジトリにコミットされるのを防ぎます。
3.  **コード内での参照:** `process.env.OPENROUTER_API_KEY` のようにして、コード内から環境変数を参照します。

これにより、APIキーを安全に管理しつつ、アプリケーションで利用することができます。

## 注意事項

-   Playwrightは初回実行時にブラウザのバイナリをダウンロードするため、最初の実行には時間がかかる場合があります。
-   ウェブサイトの構造が変更された場合、`#main` セレクタが機能しなくなる可能性があります。その場合はスクリプトの修正が必要になることがあります。
-   ネットワーク接続が必要です。また、対象のウェブサイトへのアクセスがファイアウォール等でブロックされていないことを確認してください。
-   Playwrightは初回実行時にブラウザのバイナリをダウンロードするため、最初の実行には時間がかかる場合があります。
-   ウェブサイトの構造が変更された場合、`#main` セレクタが機能しなくなる可能性があります。その場合はスクリプトの修正が必要になることがあります。
-   ネットワーク接続が必要です。また、対象のウェブサイトへのアクセスがファイアウォール等でブロックされていないことを確認してください。
-   `page.goto` のタイムアウトは現在3秒に設定されています。ネットワーク環境や対象ページの読み込み速度によっては、タイムアウトエラーが発生する可能性があります。その場合は `src/main.ts` 内の `page.goto` の `timeout` 値を調整してください。
-   OpenRouter APIを利用した処理は、APIの利用状況や選択したモデル、処理するコンテンツの量によって時間がかかることがあります。`src/main.ts` 内のOpenRouter API呼び出しのタイムアウトは現在3分 (`180000`ミリ秒) に設定されていますが、必要に応じて調整してください。また、APIの利用にはコストが発生する場合がありますのでご注意ください。
-   処理品質（Markdown化と翻訳）は、プロンプトの内容と選択したAIモデルに大きく依存します。期待する結果が得られない場合は、プロンプトファイルの内容や、`.env` で指定する `OPENROUTER_MODEL_NAME` を調整してください。
-   非常に大きなHTMLコンテンツやMarkdownコンテンツを処理する場合、AIモデルのトークン制限を超える可能性があります。`src/main.ts` 内の `processTextWithOpenRouter` 関数には簡易的なコンテンツ文字数制限（20000文字）の警告が含まれていますが、これはあくまで目安です。実際に問題が発生した場合は、コンテンツを分割して処理するなどの対策が必要になることがあります。
