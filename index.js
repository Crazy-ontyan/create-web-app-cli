#!/usr/bin/env node

const { program } = require("commander");
const inquirer = require("inquirer");
const chalk = require("chalk");
const ora = require("ora");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const pkg = require("./package.json");

// ─── ヘルパー ─────────────────────────────────────────────

const log = {
  info: (msg) => console.log(chalk.cyan("  ℹ"), msg),
  success: (msg) => console.log(chalk.green("  ✔"), msg),
  warn: (msg) => console.log(chalk.yellow("  ⚠"), msg),
  error: (msg) => console.log(chalk.red("  ✖"), msg),
  title: (msg) => console.log("\n" + chalk.bold.white(msg)),
  step: (msg) => console.log(chalk.gray("  →"), msg),
};

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, CI: "true" } });
}

function runSilent(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "pipe", env: { ...process.env, CI: "true" } });
}

// ─── shadcn/ui セットアップ ──────────────────────────────

function setupShadcn(packageManager, projectPath, useTs) {
  // components.json を自動生成
  const componentsJson = {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "default",
    rsc: true,
    tsx: useTs,
    tailwind: {
      config: useTs ? "tailwind.config.ts" : "tailwind.config.js",
      css: "src/app/globals.css",
      baseColor: "slate",
      cssVariables: true,
      prefix: "",
    },
    aliases: {
      components: "@/components",
      utils: "@/lib/utils",
      ui: "@/components/ui",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    iconLibrary: "lucide",
  };
  fs.writeFileSync(
    path.join(projectPath, "components.json"),
    JSON.stringify(componentsJson, null, 2),
  );

  // lib/utils.ts を作成
  const libDir = path.join(projectPath, "src", "lib");
  fs.mkdirSync(libDir, { recursive: true });
  const ext = useTs ? "ts" : "js";
  fs.writeFileSync(
    path.join(libDir, `utils.${ext}`),
    `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`,
  );

  const installCmd =
    packageManager === "npm"
      ? "npm install clsx tailwind-merge lucide-react"
      : "bun add clsx tailwind-merge lucide-react";
  runSilent(installCmd, projectPath);
}

// ─── Storybook セットアップ ──────────────────────────────

function setupStorybook(projectPath, framework) {
  // .storybook/main.js を作成
  const storybookDir = path.join(projectPath, ".storybook");
  fs.mkdirSync(storybookDir, { recursive: true });

  const frameworkPkg =
    framework === "nextjs" ? "@storybook/nextjs" : "@storybook/react-vite";

  fs.writeFileSync(
    path.join(storybookDir, "main.js"),
    `/** @type { import('@storybook/react').StorybookConfig } */
const config = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-onboarding',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '${frameworkPkg}',
    options: {},
  },
};
export default config;
`,
  );

  fs.writeFileSync(
    path.join(storybookDir, "preview.js"),
    `/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};
export default preview;
`,
  );

  // サンプルStoryを作成
  const storiesDir = path.join(projectPath, "src", "stories");
  fs.mkdirSync(storiesDir, { recursive: true });
  fs.writeFileSync(
    path.join(storiesDir, "Button.stories.tsx"),
    `import type { Meta, StoryObj } from '@storybook/react';

const Button = ({ label, primary }: { label: string; primary?: boolean }) => (
  <button
    style={{
      backgroundColor: primary ? '#6366f1' : 'white',
      color: primary ? 'white' : '#6366f1',
      border: '2px solid #6366f1',
      borderRadius: '6px',
      padding: '8px 20px',
      cursor: 'pointer',
      fontWeight: 500,
    }}
  >
    {label}
  </button>
);

const meta: Meta<typeof Button> = {
  title: 'Example/Button',
  component: Button,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { label: 'Button', primary: true } };
export const Secondary: Story = { args: { label: 'Button' } };
`,
  );
}

// ─── ESLint / Prettier セットアップ ─────────────────────

function setupLintPrettier(projectPath, useTs) {
  const eslintConfig = useTs
    ? `{
  "extends": ["next/core-web-vitals", "next/typescript", "prettier"]
}`
    : `{
  "extends": ["next/core-web-vitals", "prettier"]
}`;

  fs.writeFileSync(path.join(projectPath, ".eslintrc.json"), eslintConfig);

  fs.writeFileSync(
    path.join(projectPath, ".prettierrc"),
    `{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
`,
  );

  fs.writeFileSync(
    path.join(projectPath, ".prettierignore"),
    `node_modules
.next
dist
build
`,
  );
}

// ─── Next.js プロジェクト生成 ────────────────────────────

async function createNextjs(projectName, options, targetDir) {
  const { packageManager, tailwind, typescript, storybook, eslint, shadcn } =
    options;

  const flags = [
    typescript ? "--typescript" : "--javascript",
    tailwind ? "--tailwind" : "--no-tailwind",
    eslint ? "--eslint" : "--no-eslint",
    "--app",
    "--src-dir",
    "--no-git",
    packageManager === "bun" ? "--use-bun" : null,
    `--import-alias "@/*"`,
  ]
    .filter(Boolean)
    .join(" ");

  log.step(`create-next-app を実行中...`);
  const npxCmd =
    (packageManager === "npm" ? "npx" : "bunx") +
    ` create-next-app@latest ${projectName} ${flags}`;
  run(npxCmd, path.dirname(targetDir));

  if (shadcn && tailwind) {
    log.step("shadcn/ui をセットアップ中...");
    setupShadcn(packageManager, targetDir, typescript);
  }

  if (eslint && !eslint) {
    // already handled by create-next-app
  }

  if (storybook) {
    log.step("Storybook をセットアップ中...");
    const sbCmd =
      (packageManager === "npm" ? "npx" : "bunx") +
      ` storybook@latest init --yes --no-dev`;
    runSilent(sbCmd, targetDir);
  }

  if (eslint) {
    log.step("Prettier をセットアップ中...");
    const lintCmd =
      packageManager === "npm"
        ? "npm install -D prettier eslint-config-prettier"
        : "bun add -d prettier eslint-config-prettier";
    runSilent(lintCmd, targetDir);
    setupLintPrettier(targetDir, typescript);
  }
}

// ─── React (Vite) プロジェクト生成 ──────────────────────

async function createReactVite(projectName, options, targetDir) {
  const { packageManager, tailwind, typescript, storybook, eslint, shadcn } =
    options;
  const template = typescript ? "react-ts" : "react";

  log.step("Vite + React をセットアップ中...");
  const runnerCmd =
    packageManager === "npm"
      ? `npm create vite@latest ${projectName} -- --template ${template}`
      : `bun create vite@latest ${projectName} --template ${template}`;

  execSync(runnerCmd, { cwd: path.dirname(targetDir), stdio: "pipe" });
  runSilent(
    packageManager === "npm" ? "npm install" : "bun install",
    targetDir,
  );

  if (tailwind) {
    log.step("TailwindCSS をセットアップ中...");
    runSilent(
      (packageManager === "npm" ? "npm install -D" : "bun add -d") +
        " tailwindcss @tailwindcss/vite",
      targetDir,
    );

    // vite.config にplugin追加
    const viteConfig = path.join(
      targetDir,
      typescript ? "vite.config.ts" : "vite.config.js",
    );
    let viteContent = fs.readFileSync(viteConfig, "utf8");
    viteContent = viteContent
      .replace(
        "import react from '@vitejs/plugin-react'",
        "import react from '@vitejs/plugin-react'\nimport tailwindcss from '@tailwindcss/vite'",
      )
      .replace(
        /plugins:\s*\[\s*react\(\)\s*\]/,
        "plugins: [react(), tailwindcss()]",
      );
    fs.writeFileSync(viteConfig, viteContent);

    // CSS に @import 追加
    const cssPath = path.join(targetDir, "src", "index.css");
    fs.writeFileSync(cssPath, `@import "tailwindcss";\n`);
  }

  if (shadcn && tailwind) {
    log.step("shadcn/ui (Vite用) をセットアップ中...");
    // tsconfig path alias
    if (typescript) {
      const tsconfig = JSON.parse(
        fs.readFileSync(path.join(targetDir, "tsconfig.json"), "utf8"),
      );
      tsconfig.compilerOptions = tsconfig.compilerOptions || {};
      tsconfig.compilerOptions.baseUrl = ".";
      tsconfig.compilerOptions.paths = { "@/*": ["./src/*"] };
      fs.writeFileSync(
        path.join(targetDir, "tsconfig.json"),
        JSON.stringify(tsconfig, null, 2),
      );
    }
    runSilent(
      (packageManager === "npm" ? "npm install" : "bun add") +
        " clsx tailwind-merge lucide-react",
      targetDir,
    );
    const libDir = path.join(targetDir, "src", "lib");
    fs.mkdirSync(libDir, { recursive: true });
    fs.writeFileSync(
      path.join(libDir, "utils.ts"),
      `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`,
    );
  }

  if (storybook) {
    log.step("Storybook をセットアップ中...");
    // storybook init に任せることでバージョン整合性を自動解決
    runSilent(
      (packageManager === "npm" ? "npx" : "bunx") +
        " storybook@latest init --yes --no-dev",
      targetDir,
    );
  }

  if (eslint) {
    log.step("Prettier をセットアップ中...");
    runSilent(
      (packageManager === "npm" ? "npm install -D" : "bun add -d") +
        " prettier eslint-config-prettier",
      targetDir,
    );
    fs.writeFileSync(
      path.join(targetDir, ".prettierrc"),
      `{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
`,
    );
  }
}

// ─── Vue (Vite) プロジェクト生成 ────────────────────────

async function createVueVite(projectName, options, targetDir) {
  const { packageManager, tailwind, typescript, storybook, eslint } = options;
  const template = typescript ? "vue-ts" : "vue";

  log.step("Vite + Vue をセットアップ中...");

  //Windows/Mac/Linux共通で動く方法として、echo（空の改行）をパイプで流し込む
  // これにより、最後のプロンプトで「No」を自動選択させた状態になり、勝手に起動（ハング）することなく終了できるように
  const runnerCmd =
    packageManager === "npm"
      ? `npm create vite@latest ${projectName} -- --template ${template}`
      : `bun create vite@latest ${projectName} --template ${template}`;

  execSync(runnerCmd, { cwd: path.dirname(targetDir), stdio: "pipe" });

  log.step("ベースパッケージをインストール中...");
  runSilent(
    packageManager === "npm" ? "npm install" : "bun install",
    targetDir,
  );

  if (tailwind) {
    log.step("TailwindCSS をセットアップ中...");
    runSilent(
      (packageManager === "npm" ? "npm install -D" : "bun add -d") +
        " tailwindcss @tailwindcss/vite",
      targetDir,
    );

    const viteConfig = path.join(
      targetDir,
      typescript ? "vite.config.ts" : "vite.config.js",
    );
    let viteContent = fs.readFileSync(viteConfig, "utf8");
    viteContent = viteContent
      .replace(
        "import vue from '@vitejs/plugin-vue'",
        "import vue from '@vitejs/plugin-vue'\nimport tailwindcss from '@tailwindcss/vite'",
      )
      .replace(
        /plugins:\s*\[\s*vue\(\)\s*\]/,
        "plugins: [vue(), tailwindcss()]",
      );
    fs.writeFileSync(viteConfig, viteContent);

    const cssPath = path.join(targetDir, "src", "style.css");
    fs.writeFileSync(cssPath, `@import "tailwindcss";\n`);
  }

  if (storybook) {
    log.step("Storybook (Vue) をセットアップ中...");
    runSilent(
      (packageManager === "npm" ? "npx" : "bunx") +
        " storybook@latest init --yes --no-dev",
      targetDir,
    );
  }

  if (eslint) {
    log.step("Prettier をセットアップ中...");
    runSilent(
      (packageManager === "npm" ? "npm install -D" : "bun add -d") +
        " prettier",
      targetDir,
    );
    fs.writeFileSync(
      path.join(targetDir, ".prettierrc"),
      `{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
`,
    );
  }
}

// ─── React (Farm) プロジェクト生成 ──────────────────────

async function createReactFarm(projectName, options, targetDir) {
  const { packageManager, tailwind, typescript, storybook, eslint, shadcn } =
    options;

  log.step("Farm + React をセットアップ中...");
  const runnerCmd =
    packageManager === "npm"
      ? `npm create farm@latest ${projectName} --template react`
      : `bun create farm@latest ${projectName} --template react`;

  execSync(runnerCmd, { cwd: path.dirname(targetDir), stdio: "pipe" });
  runSilent(
    packageManager === "npm" ? "npm install" : "bun install",
    targetDir,
  );

  if (tailwind) {
    log.step("TailwindCSS をセットアップ中...");
    runSilent(
      (packageManager === "npm" ? "npm install -D" : "bun add -d") +
        " tailwindcss @tailwindcss/postcss postcss @farmfe/js-plugin-postcss",
      targetDir,
    );

    // postcss.config.mjs にplugin追加
    const postcssConfig = path.join(targetDir, "postcss.config.mjs");
    const postcssContent = `export default {
      plugins: {
        "@tailwindcss/postcss": {},
      }
    }`;
    fs.writeFileSync(postcssConfig, postcssContent);

    // CSS に @import 追加
    const cssPath = path.join(targetDir, "src", "index.css");
    fs.writeFileSync(cssPath, `@import "tailwindcss";\n`);

    //farm.config.tsにplugin追加
    const farmConfig = path.join(targetDir, "farm.config.ts");
    let farmContent = fs.readFileSync(farmConfig, "utf8");
    if (!farmContent.includes("farmPostcssPlugin")) {
      farmContent = farmContent.replace(
        "import { defineConfig } from '@farmfe/core'",
        "import { defineConfig } from '@farmfe/core'\nimport farmPostcssPlugin from '@farmfe/js-plugin-postcss'",
      );
    }

    if (
      farmContent.includes("plugins:") &&
      !farmContent.includes("farmPostcssPlugin()")
    ) {
      farmContent = farmContent.replace(
        /plugins:\s*\[/,
        "plugins: [\n    farmPostcssPlugin(),",
      );
    }

    fs.writeFileSync(farmConfig, farmContent, "utf8");
  }

  //shadcn/uiとtailwindcssを使う場合のセットアップ処理
  if (shadcn && tailwind) {
    log.step("shadcn/ui (Farm用) をセットアップ中...");

    // 1. tsconfig.json を読み込む
    const rawTsconfig = fs.readFileSync(
      path.join(targetDir, "tsconfig.json"),
      "utf8",
    );

    // 正規表現でコメント（// や /* */）を取り除く
    const cleanedTsconfig = rawTsconfig
      .replace(/\/\*[\s\S]*?\*\//g, "") // ブロックコメント (/* */) を削除
      .replace(/\/\/.*/g, ""); // 行コメント (//) を削除

    // コメントを除去した文字列をパースする
    const tsconfig = JSON.parse(cleanedTsconfig);

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions.paths = { "@/*": ["./src/*"] };

    fs.writeFileSync(
      path.join(targetDir, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2),
    );

    runSilent(
      (packageManager === "npm" ? "npm install" : "bun add") +
        " clsx tailwind-merge lucide-react class-variance-authority",
      targetDir,
    );
    const libDir = path.join(targetDir, "src", "lib");
    fs.mkdirSync(libDir, { recursive: true });
    fs.writeFileSync(
      path.join(libDir, "utils.ts"),
      `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`,
    );
    const componentsConfig = path.join(targetDir, "components.json");
    const componentsContent = `{
  "$schema": "https://ui.shadcn.com/docs/components.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib"
  },
  "iconLibrary": "lucide"
}`;
    fs.writeFileSync(componentsConfig, componentsContent);

    const shadcnContent = `@import "tailwindcss";

@theme {
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
}

:root {
  --background: #ffffff;
  --foreground: #020817;
  --primary: #0f172a;
  --primary-foreground: #f8fafc;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --destructive: #ef4444;
  --destructive-foreground: #f8fafc;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #f1f5f9;
  --accent-foreground: #0f172a;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #0f172a;
  --radius: 0.5rem;
}`;
    const cssPath = path.join(targetDir, "src", "index.css");
    fs.writeFileSync(cssPath, shadcnContent);
  }

  //storybookを使う場合のセットアップ処理
  if (storybook) {
    log.step("Storybook をセットアップ中...");
    // storybook init に任せることでバージョン整合性を自動解決
    runSilent(
      (packageManager === "npm" ? "npx" : "bunx") +
        " storybook@latest init --type react --builder vite --yes",
      targetDir,
    );
    if (tailwind) {
      const previewPath = path.join(targetDir, ".storybook", "preview.ts");
      const importLine = 'import "../src/index.css";';

      // ファイルがまだ存在しない場合の初期テンプレート
      const initialTemplate = `import type { Preview } from "@storybook/react";
${importLine}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
`;

      try {
        // 1. フォルダが存在しない可能性もあるため、念のため親フォルダを作成
        const dirPath = path.dirname(previewPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        // 2. ファイルが存在しない場合は、新規作成して終了
        if (!fs.existsSync(previewPath)) {
          fs.writeFileSync(previewPath, initialTemplate, "utf8");
          console.log(
            "preview.ts を新規作成し、CSSのインポートを追加しました。",
          );
        } else {
          // 3. ファイルが存在する場合は、2行目に挿入する
          const content = fs.readFileSync(previewPath, "utf8");

          // 二重追加を防止
          if (!content.includes(importLine)) {
            const lines = content.split(/\r?\n/);

            // 2行目（配列のインデックス 1）に挿入
            lines.splice(1, 0, importLine);

            // 配列を結合して書き込み
            const updatedContent = lines.join("\n");
            fs.writeFileSync(previewPath, updatedContent, "utf8");
            console.log("preview.ts の2行目にCSSのインポートを追記しました。");
          } else {
            console.log(
              "既にCSSのインポートが記述されているため、スキップしました。",
            );
          }
        }
      } catch (error) {
        console.error("ファイルの処理中にエラーが発生しました:", error);
      }
      const tsconfig = JSON.parse(
        fs.readFileSync(path.join(targetDir, "tsconfig.json"), "utf8"),
      );
      tsconfig.include = tsconfig.include || [];
      tsconfig.include = ["src", ".storybook/**/*"];
      fs.writeFileSync(
        path.join(targetDir, "tsconfig.json"),
        JSON.stringify(tsconfig, null, 2),
      );
    }

    //storybookを使用するかつ、shadcn/uiとtailwindcssを使う場合のセットアップ処理
    if (shadcn && tailwind) {
      //plugin追加
      runSilent(
        (packageManager === "npm" ? "npm install -D" : "bun add -d") +
          " vite-tsconfig-paths",
        targetDir,
      );
      const mainConfigPath = path.join(targetDir, ".storybook", "main.ts");

      // 1. 置き換える（または新規作成する）コード全体
      const updatedConfigTemplate = `import type { StorybookConfig } from '@storybook/react-vite';
import tsconfigPaths from "vite-tsconfig-paths"

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp"
  ],
  "framework": "@storybook/react-vite",

  "viteFinal": async (config) => {
    config.plugins = config.plugins || [];
    config.plugins.push(tsconfigPaths());
    return config;
  },
};

export default config;
`;

      try {
        // 2. 念のため親フォルダ（.storybook）が存在するか確認し、なければ作成
        const dirPath = path.dirname(mainConfigPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        // 3. すでに書き換え済みかどうかのチェック（二重処理の防止）
        let isAlreadyUpdated = false;
        if (fs.existsSync(mainConfigPath)) {
          const currentContent = fs.readFileSync(mainConfigPath, "utf8");
          if (
            currentContent.includes("viteFinal") &&
            currentContent.includes("vite-tsconfig-paths")
          ) {
            isAlreadyUpdated = true;
          }
        }

        // 4. ファイルの書き込み・上書き
        if (!isAlreadyUpdated) {
          fs.writeFileSync(mainConfigPath, updatedConfigTemplate, "utf8");
          console.log(
            "main.ts を更新（または新規作成）し、viteFinal と tsconfigPaths を追加しました。",
          );
        } else {
          console.log("main.ts は既に更新済みのため、処理をスキップしました。");
        }
      } catch (error) {
        console.error("ファイルの書き換え中にエラーが発生しました:", error);
      }
    }
  }

  //eslintとprettierを使う場合のセットアップ処理
  if (eslint) {
    log.step("Prettier をセットアップ中...");
    runSilent(
      (packageManager === "npm" ? "npm install -D" : "bun add -d") +
        " eslint prettier eslint-config-prettier eslint-plugin-react-hooks eslint-plugin-react-refresh @typescript-eslint/eslint-plugin @typescript-eslint/parser @eslint/js typescript-eslint",
      targetDir,
    );
    fs.writeFileSync(
      path.join(targetDir, ".prettierrc"),
      `{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
`,
    );
    fs.writeFileSync(
      path.join(targetDir, "eslint.config.js"),
      `import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", ".farm"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  eslintConfigPrettier
);`,
    );

    fs.writeFileSync(
      path.join(targetDir, ".prettierignore"),
      `dist
.farm
node_modules`,
    );
    const packageconfig = JSON.parse(
      fs.readFileSync(path.join(targetDir, "package.json"), "utf8"),
    );
    packageconfig.scripts = packageconfig.scripts || {};
    packageconfig.scripts.lint = "eslint .";
    packageconfig.scripts.format =
      'prettier --write "src/**/*.{ts,tsx,css,json}"';
    packageconfig.type = "module";
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify(packageconfig, null, 2),
    );
  }
}

// ─── 完了メッセージ ──────────────────────────────────────

function printSuccess(projectName, options) {
  const {
    packageManager,
    framework,
    tailwind,
    typescript,
    storybook,
    eslint,
    shadcn,
  } = options;
  const tags = [
    chalk.magenta(packageManager),
    chalk.magenta(framework),
    typescript && chalk.blue("TypeScript"),
    tailwind && chalk.cyan("Tailwind"),
    shadcn && chalk.yellow("shadcn/ui"),
    storybook && chalk.green("Storybook"),
    eslint && chalk.gray("ESLint+Prettier"),
  ]
    .filter(Boolean)
    .join(chalk.gray(" + "));

  console.log(
    "\n" +
      chalk.bgGreen.black(" DONE ") +
      " " +
      chalk.bold(projectName) +
      chalk.gray(" が作成されました"),
  );
  console.log(chalk.gray("  構成:"), tags);
  console.log("\n" + chalk.bold("  次のステップ:"));
  console.log(chalk.cyan(`    cd ${projectName}`));
  console.log(
    chalk.cyan(
      "    " + (packageManager === "npm" ? "npm run dev" : "bun run dev"),
    ),
  );
  if (storybook)
    console.log(
      chalk.cyan(
        "    " + (packageManager === "npm" ? "npm" : "bun") + " run storybook",
      ),
    );
  console.log();
}

// ─── メインの対話フロー ──────────────────────────────────

async function main() {
  console.log(
    "\n" +
      chalk.bold.cyan("◆ create-web-app-cli") +
      chalk.gray("  プロジェクト雛形ジェネレーター\n"),
  );

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "プロジェクト名:",
      default: "my-app",
      validate: (v) =>
        /^[a-z0-9-_]+$/.test(v) || "小文字・数字・ハイフンのみ使用可能です",
    },
    {
      type: "list",
      name: "packageManager",
      message: "パッケージマネージャー",
      choices: [
        { name: "npm", value: "npm" },
        { name: "bun", value: "bun" },
      ],
    },
    {
      type: "list",
      name: "framework",
      message: "フレームワーク:",
      choices: [
        { name: "Next.js  (App Router)", value: "nextjs" },
        { name: "React    (Vite)", value: "react_vite" },
        { name: "Vue 3    (Vite)", value: "vue" },
        { name: "React    (Farm)", value: "react_farm" },
      ],
    },
    {
      type: "confirm",
      name: "typescript",
      message: "TypeScript を使う?",
      default: true,
      when: (ans) => ans.framework !== "react_farm",
    },
    {
      type: "confirm",
      name: "tailwind",
      message: "TailwindCSS を追加する?",
      default: true,
    },
    {
      type: "confirm",
      name: "shadcn",
      message: "shadcn/ui を追加する?",
      default: false,
      when: (ans) => ans.tailwind && ans.framework !== "vue",
    },
    {
      type: "confirm",
      name: "eslint",
      message: "ESLint + Prettier を追加する?",
      default: true,
    },
    {
      type: "confirm",
      name: "storybook",
      message: "Storybook を追加する?",
      default: false,
    },
    {
      type: "confirm",
      name: "confirm",
      message: (ans) => {
        const opts = [
          ans.packageManager === "npm" ? "npm" : "bun",
          ans.framework === "nextjs"
            ? "Next.js"
            : ans.framework === "react_vite"
              ? "React+Vite"
              : ans.framework === "vue"
                ? "Vue+Vite"
                : "React+Farm",
          ans.typescript ? "TypeScript" : ans.framework === "react_farm" ? "TypeScript" : "JavaScript",
          ans.tailwind ? "Tailwind" : null,
          ans.shadcn ? "shadcn/ui" : null,
          ans.eslint ? "ESLint+Prettier" : null,
          ans.storybook ? "Storybook" : null,
        ]
          .filter(Boolean)
          .join(" + ");
        return `\n  構成: ${chalk.cyan(opts)}\n  この内容でプロジェクトを作成しますか?`;
      },
      default: true,
    },
  ]);

  if (!answers.confirm) {
    log.warn("キャンセルしました");
    process.exit(0);
  }

  const {
    projectName,
    packageManager,
    framework,
    typescript,
    tailwind,
    eslint,
    storybook,
  } = answers;
  const shadcn = answers.shadcn || false;
  const targetDir = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(targetDir)) {
    log.error(`"${projectName}" ディレクトリがすでに存在します`);
    process.exit(1);
  }

  console.log();
  const spinner = ora(chalk.gray("セットアップを開始します...")).start();
  spinner.stop();

  try {
    const opts = {
      packageManager,
      framework,
      typescript,
      tailwind,
      eslint,
      storybook,
      shadcn,
    };

    if (framework === "nextjs") {
      await createNextjs(projectName, opts, targetDir);
    } else if (framework === "react_vite") {
      await createReactVite(projectName, opts, targetDir);
    } else if (framework === "vue") {
      await createVueVite(projectName, opts, targetDir);
    } else if (framework === "react_farm") {
      await createReactFarm(projectName, opts, targetDir);
    }

    printSuccess(projectName, opts);
  } catch (err) {
    log.error("エラーが発生しました:");
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

program
  .name("create-web-app-cli")
  .version(pkg.version)
  .description("対話型フロントエンドプロジェクトジェネレーター")
  .action(main);

program.parse(process.argv);
