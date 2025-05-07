# 計画: HashiCorp Docs 翻訳ツールの改善

## 修正点

1. **ファイル名から冗長な接頭語を削除**
   - 現在: `developer.hashicorp.com-vault-docs-[パス]-[ファイル名]_ja.md`
   - 修正後: `[パス]-[ファイル名]_ja.md`

2. **翻訳処理の改善（大きなコンテンツの分割処理）**
   - 原文が長すぎる場合にコンテキスト長を超える問題を解決
   - 論理的な構造（見出し）に基づいて分割
   - 最大5000字のチャンクに分割して順次処理
   - 最終的には1つのファイルにまとめる

## 実装計画

### 1. ファイル名生成ロジックの修正

```typescript
// 現在のコード（概略）
const urlParts = url.replace(/^https?:\/\//, '').split('/');
const filename = urlParts.join('-').replace(/[^\w.-]/g, '') + '_ja.md';

// 修正後のコード（概略）
const urlParts = url.replace(/^https?:\/\//, '').split('/');
// "developer.hashicorp.com" と "vault/docs" を除去
if (urlParts[0] === "developer.hashicorp.com" && urlParts[1] === "vault" && urlParts[2] === "docs") {
  urlParts.splice(0, 3);
}
const filename = urlParts.join('-').replace(/[^\w.-]/g, '') + '_ja.md';
```

### 2. 見出しベースの分割処理の実装

```typescript
function splitMarkdownByHeadings(markdown: string, maxChunkSize: number = 5000): string[] {
  // 最初に H1 見出し（# で始まる行）で分割
  const h1Pattern = /^# .+$/m;
  const h1Sections = [];
  
  // 最初のH1見出し前のコンテンツを取得（存在する場合）
  let firstH1Index = markdown.search(h1Pattern);
  if (firstH1Index > 0) {
    h1Sections.push(markdown.substring(0, firstH1Index).trim());
  }
  
  // H1見出しで分割
  const h1Matches = markdown.match(new RegExp(h1Pattern, 'g')) || [];
  for (let i = 0; i < h1Matches.length; i++) {
    const h1 = h1Matches[i];
    const h1Index = markdown.indexOf(h1, firstH1Index);
    
    // 次のH1見出しのインデックスを取得（または文書の終わり）
    const nextH1Index = i < h1Matches.length - 1 
      ? markdown.indexOf(h1Matches[i + 1], h1Index + h1.length)
      : markdown.length;
    
    // H1セクションを抽出
    const h1Section = markdown.substring(h1Index, nextH1Index).trim();
    
    // H1セクションが制限サイズ以内なら追加
    if (h1Section.length <= maxChunkSize) {
      h1Sections.push(h1Section);
    } else {
      // H1セクションが大きすぎる場合は H2 見出しで分割
      const h2Pattern = /^## .+$/m;
      const h2Matches = h1Section.match(new RegExp(h2Pattern, 'g')) || [];
      
      if (h2Matches.length > 0) {
        // 最初のH2見出し前のコンテンツを取得（H1見出しを含む）
        let firstH2Index = h1Section.search(h2Pattern);
        if (firstH2Index > 0) {
          h1Sections.push(h1Section.substring(0, firstH2Index).trim());
        }
        
        // H2見出しで分割
        for (let j = 0; j < h2Matches.length; j++) {
          const h2 = h2Matches[j];
          const h2Index = h1Section.indexOf(h2, j === 0 ? firstH2Index : 0);
          
          // 次のH2見出しのインデックスを取得（または文書の終わり）
          const nextH2Index = j < h2Matches.length - 1 
            ? h1Section.indexOf(h2Matches[j + 1], h2Index + h2.length)
            : h1Section.length;
          
          // H2セクションを抽出
          const h2Section = h1Section.substring(h2Index, nextH2Index).trim();
          
          // H2セクションが制限サイズ以内なら追加
          if (h2Section.length <= maxChunkSize) {
            h1Sections.push(h2Section);
          } else {
            // H2セクションが大きすぎる場合は段落で分割
            const paragraphs = h2Section.split(/\n\s*\n/).filter(p => p.trim() !== '');
            let currentChunk = '';
            
            for (const paragraph of paragraphs) {
              if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
                h1Sections.push(currentChunk);
                currentChunk = paragraph;
              } else {
                if (currentChunk.length > 0) {
                  currentChunk += '\n\n' + paragraph;
                } else {
                  currentChunk = paragraph;
                }
              }
            }
            
            if (currentChunk.length > 0) {
              h1Sections.push(currentChunk);
            }
          }
        }
      } else {
        // H2見出しがない場合は段落で分割
        const paragraphs = h1Section.split(/\n\s*\n/).filter(p => p.trim() !== '');
        let currentChunk = '';
        
        for (const paragraph of paragraphs) {
          if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
            h1Sections.push(currentChunk);
            currentChunk = paragraph;
          } else {
            if (currentChunk.length > 0) {
              currentChunk += '\n\n' + paragraph;
            } else {
              currentChunk = paragraph;
            }
          }
        }
        
        if (currentChunk.length > 0) {
          h1Sections.push(currentChunk);
        }
      }
    }
    
    // 次のH1検索の開始位置を更新
    firstH1Index = nextH1Index;
  }
  
  return h1Sections;
}
```

### 3. 翻訳処理の修正

```typescript
async function translateEnglishMarkdownToJapanese(markdownContent: string): Promise<string> {
  // 見出しベースで分割（最大5000文字）
  const chunks = splitMarkdownByHeadings(markdownContent, 5000);
  
  let translatedContent = '';
  
  // 各チャンクを順次翻訳
  for (const chunk of chunks) {
    console.log(`Translating chunk (${chunk.length} characters)...`);
    const translatedChunk = await processTextWithOpenRouter(
      englishToJapanesePromptTemplate, 
      chunk, 
      'English Markdown to Japanese Translation'
    );
    
    // 翻訳結果を結合
    if (translatedContent.length > 0) {
      translatedContent += '\n\n' + translatedChunk;
    } else {
      translatedContent = translatedContent = translatedChunk;
    }
  }
  
  return translatedContent;
}
```

## 実装ステップ

1. `src/main.ts` のファイル名生成ロジックを修正する
2. 見出しベースの分割関数 `splitMarkdownByHeadings` を実装する
3. 翻訳関数 `translateEnglishMarkdownToJapanese` を修正して分割処理を組み込む
4. 必要に応じて `README.md` を更新する

## 期待される効果

1. ファイル名がより簡潔になり、扱いやすくなる
2. 大きなドキュメントでもトークン制限を超えることなく処理できる
3. 論理的な構造（章や節）に沿った分割により、翻訳品質が向上する
4. 最終的には1つのファイルとして出力されるため、ユーザーエクスペリエンスは変わらない
