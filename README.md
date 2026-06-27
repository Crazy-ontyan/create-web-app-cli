# create-web-app-cli
CLIでweb開発の様々な雛形を生成できるツール  

現在以下に対応しています。  
  
パッケージマネージャー: npm, bun  
フレームワーク: Next.js (App Router) / React (Vite) / Vue 3 (Vite) / React(Farm)
オプション: TailwindCSS, shadcn/ui, Storybook, ESLint/Prettier, TypeScript  

## 使用方法
### ①グローバルインストール  
```bash
git clone https://github.com/Crazy-ontyan/create-web-app-cli.git
cd create-web-app-cli
npm install
npm link
``` 
インストール後は任意のディレクトリで使えます:  
```bash
create-web-app-cli
```  

### ②クローンせず直接実行  
```bash
npx github:Crazy-ontyan/create-web-app-cli
```  
### ③ Bun で実行する場合

Bun でも動作します。

```bash
git clone https://github.com/Crazy-ontyan/create-web-app-cli.git
cd create-web-app-cli
bun install
bun link
```

インストール後:

```bash
create-web-app-cli
```

クローンせず直接実行する場合:

```bash
bunx github:Crazy-ontyan/create-web-app-cli
```

---

## アンインストール

```bash
npm unlink create-web-app-cli
```

Bun でインストールした場合:

```bash
bun unlink create-web-app-cli
```

---
  
## 使い方の流れ

```bash
create-web-app-cli
```

起動すると対話メニューが表示されます:

```
◆ create-web-app-cli  プロジェクト雛形ジェネレーター

? プロジェクト名: my-awesome-app
? パッケージマネージャー: bun
? フレームワーク: Next.js  (App Router)
? TypeScript を使う? Yes
? TailwindCSS を追加する? Yes
? shadcn/ui を追加する? Yes
? ESLint + Prettier を追加する? Yes
? Storybook を追加する? No

  構成: bun + Next.js + TypeScript + Tailwind + shadcn/ui + ESLint+Prettier
  この内容でプロジェクトを作成しますか? Yes

  → create-next-app を実行中...
  → shadcn/ui をセットアップ中...
  → Prettier をセットアップ中...

 DONE  my-awesome-app が作成されました
  構成: bun + Next.js + TypeScript + Tailwind + shadcn/ui + ESLint+Prettier

  次のステップ:
    cd my-awesome-app
    bun run dev
```

選択したパッケージマネージャーに応じて、生成されるプロジェクトの依存関係インストールや実行コマンド（`npm run dev` / `bun run dev`）が自動的に切り替わります。

※ shadcn/ui は TailwindCSS 選択時のみ、かつ Next.js / React のみ選択可能です（Vueは非対応）。

---

## 動作要件

- Node.js 18 以上
- npm 8 以上、または Bun 1.0 以上（生成するプロジェクトでbunを選ぶ場合は実行環境にbunが必要です）
