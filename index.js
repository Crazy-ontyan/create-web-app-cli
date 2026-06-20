#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pkg = require('./package.json');

// ─── ヘルパー ─────────────────────────────────────────────

const log = {
  info:    (msg) => console.log(chalk.cyan('  ℹ'), msg),
  success: (msg) => console.log(chalk.green('  ✔'), msg),
  warn:    (msg) => console.log(chalk.yellow('  ⚠'), msg),
  error:   (msg) => console.log(chalk.red('  ✖'), msg),
  title:   (msg) => console.log('\n' + chalk.bold.white(msg)),
  step:    (msg) => console.log(chalk.gray('  →'), msg),
};

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: {...process.env, CI: 'true' } });
}

function runSilent(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'pipe', env: {...process.env, Ci: 'true' } });
}

// ─── shadcn/ui セットアップ ──────────────────────────────

function setupShadcn(projectPath, useTs) {
  // components.json を自動生成
  const componentsJson = {
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "default",
    "rsc": true,
    "tsx": useTs,
    "tailwind": {
      "config": useTs ? "tailwind.config.ts" : "tailwind.config.js",
      "css": "src/app/globals.css",
      "baseColor": "slate",
      "cssVariables": true,
      "prefix": ""
    },
    "aliases": {
      "components": "@/components",
      "utils": "@/lib/utils",
      "ui": "@/components/ui",
      "lib": "@/lib",
      "hooks": "@/hooks"
    },
    "iconLibrary": "lucide"
  };
  fs.writeFileSync(
    path.join(projectPath, 'components.json'),
    JSON.stringify(componentsJson, null, 2)
  );

  // lib/utils.ts を作成
  const libDir = path.join(projectPath, 'src', 'lib');
  fs.mkdirSync(libDir, { recursive: true });
  const ext = useTs ? 'ts' : 'js';
  fs.writeFileSync(path.join(libDir, `utils.${ext}`), `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`);

  runSilent('npm install clsx tailwind-merge lucide-react', projectPath);
}

// ─── Storybook セットアップ ──────────────────────────────

function setupStorybook(projectPath, framework) {
  // .storybook/main.js を作成
  const storybookDir = path.join(projectPath, '.storybook');
  fs.mkdirSync(storybookDir, { recursive: true });

  const frameworkPkg = framework === 'nextjs'
    ? '@storybook/nextjs'
    : '@storybook/react-vite';

  fs.writeFileSync(path.join(storybookDir, 'main.js'), `/** @type { import('@storybook/react').StorybookConfig } */
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
`);

  fs.writeFileSync(path.join(storybookDir, 'preview.js'), `/** @type { import('@storybook/react').Preview } */
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
`);

  // サンプルStoryを作成
  const storiesDir = path.join(projectPath, 'src', 'stories');
  fs.mkdirSync(storiesDir, { recursive: true });
  fs.writeFileSync(path.join(storiesDir, 'Button.stories.tsx'), `import type { Meta, StoryObj } from '@storybook/react';

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
`);
}

// ─── ESLint / Prettier セットアップ ─────────────────────

function setupLintPrettier(projectPath, useTs) {
  const eslintConfig = useTs ? `{
  "extends": ["next/core-web-vitals", "next/typescript", "prettier"]
}` : `{
  "extends": ["next/core-web-vitals", "prettier"]
}`;

  fs.writeFileSync(path.join(projectPath, '.eslintrc.json'), eslintConfig);

  fs.writeFileSync(path.join(projectPath, '.prettierrc'), `{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
`);

  fs.writeFileSync(path.join(projectPath, '.prettierignore'), `node_modules
.next
dist
build
`);
}

// ─── Next.js プロジェクト生成 ────────────────────────────

async function createNextjs(projectName, options, targetDir) {
  const { tailwind, typescript, storybook, eslint, shadcn } = options;

  const flags = [
    typescript    ? '--typescript'    : '--javascript',
    tailwind      ? '--tailwind'      : '--no-tailwind',
    eslint        ? '--eslint'        : '--no-eslint',
    '--app',
    '--src-dir',
    '--no-git',
    `--import-alias "@/*"`,
  ].join(' ');

  log.step(`create-next-app を実行中...`);
  run(`npx create-next-app@latest ${projectName} ${flags}`, path.dirname(targetDir));

  if (shadcn && tailwind) {
    log.step('shadcn/ui をセットアップ中...');
    setupShadcn(targetDir, typescript);
  }

  if (eslint && !eslint) {
    // already handled by create-next-app
  }

  if (storybook) {
    log.step('Storybook をセットアップ中...');
    runSilent(
      `npx storybook@latest init --yes --no-dev`,
      targetDir
    );
  }

  if (eslint) {
    log.step('Prettier をセットアップ中...');
    runSilent('npm install -D prettier eslint-config-prettier', targetDir);
    setupLintPrettier(targetDir, typescript);
  }
}

// ─── React (Vite) プロジェクト生成 ──────────────────────

async function createReactVite(projectName, options, targetDir) {
  const { tailwind, typescript, storybook, eslint, shadcn } = options;
  const template = typescript ? 'react-ts' : 'react';

  log.step('Vite + React をセットアップ中...');
  const cmd = process.platform === 'win32'
    ? `cmd /c "echo. | npx create-vite@latest ${projectName} --template ${template}"`
    : `echo "" | npx create-vite@latest ${projectName} --template ${template}`;

  execSync(cmd, { cwd: path.dirname(targetDir), stdio: 'pipe' });
  runSilent('npm install', targetDir);

  if (tailwind) {
    log.step('TailwindCSS をセットアップ中...');
    runSilent('npm install -D tailwindcss @tailwindcss/vite', targetDir);

    // vite.config にplugin追加
    const viteConfig = path.join(targetDir, typescript ? 'vite.config.ts' : 'vite.config.js');
    let viteContent = fs.readFileSync(viteConfig, 'utf8');
    viteContent = viteContent.replace(
      "import react from '@vitejs/plugin-react'",
      "import react from '@vitejs/plugin-react'\nimport tailwindcss from '@tailwindcss/vite'"
    ).replace(
      'plugins: [react()]',
      'plugins: [react(), tailwindcss()]'
    );
    fs.writeFileSync(viteConfig, viteContent);

    // CSS に @import 追加
    const cssPath = path.join(targetDir, 'src', 'index.css');
    fs.writeFileSync(cssPath, `@import "tailwindcss";\n`);
  }

  if (shadcn && tailwind) {
    log.step('shadcn/ui (Vite用) をセットアップ中...');
    // tsconfig path alias
    if (typescript) {
      const tsconfig = JSON.parse(fs.readFileSync(path.join(targetDir, 'tsconfig.json'), 'utf8'));
      tsconfig.compilerOptions = tsconfig.compilerOptions || {};
      tsconfig.compilerOptions.baseUrl = '.';
      tsconfig.compilerOptions.paths = { '@/*': ['./src/*'] };
      fs.writeFileSync(path.join(targetDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
    }
    runSilent('npm install clsx tailwind-merge lucide-react', targetDir);
    const libDir = path.join(targetDir, 'src', 'lib');
    fs.mkdirSync(libDir, { recursive: true });
    fs.writeFileSync(path.join(libDir, 'utils.ts'), `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`);
  }

  if (storybook) {
    log.step('Storybook をセットアップ中...');
    // storybook init に任せることでバージョン整合性を自動解決
    runSilent('npx storybook@latest init --yes --no-dev', targetDir);
  }

  if (eslint) {
    log.step('Prettier をセットアップ中...');
    runSilent('npm install -D prettier eslint-config-prettier', targetDir);
    fs.writeFileSync(path.join(targetDir, '.prettierrc'), `{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
`);
  }
}

// ─── Vue (Vite) プロジェクト生成 ────────────────────────

async function createVueVite(projectName, options, targetDir) {
  const { tailwind, typescript, storybook, eslint } = options;
  const template = typescript ? 'vue-ts' : 'vue';

  log.step('Vite + Vue をセットアップ中...');
  
  //Windows/Mac/Linux共通で動く方法として、echo（空の改行）をパイプで流し込む
  // これにより、最後のプロンプトで「No」を自動選択させた状態になり、勝手に起動（ハング）することなく終了できるように
  const cmd = process.platform === 'win32'
    ? `cmd /c "echo. | npx create-vite@latest ${projectName} --template ${template}"`
    : `echo "" | npx create-vite@latest ${projectName} --template ${template}`;

  execSync(cmd, { cwd: path.dirname(targetDir), stdio: 'pipe' });

  log.step('ベースパッケージをインストール中...');
  runSilent('npm install', targetDir);

  if (tailwind) {
    log.step('TailwindCSS をセットアップ中...');
    runSilent('npm install -D tailwindcss @tailwindcss/vite', targetDir);

    const viteConfig = path.join(targetDir, typescript ? 'vite.config.ts' : 'vite.config.js');
    let viteContent = fs.readFileSync(viteConfig, 'utf8');
    viteContent = viteContent.replace(
      "import vue from '@vitejs/plugin-vue'",
      "import vue from '@vitejs/plugin-vue'\nimport tailwindcss from '@tailwindcss/vite'"
    ).replace(
      'plugins: [vue()]',
      'plugins: [vue(), tailwindcss()]'
    );
    fs.writeFileSync(viteConfig, viteContent);

    const cssPath = path.join(targetDir, 'src', 'style.css');
    fs.writeFileSync(cssPath, `@import "tailwindcss";\n`);
  }

  if (storybook) {
    log.step('Storybook (Vue) をセットアップ中...');
    runSilent('npx storybook@latest init --yes --no-dev', targetDir);
  }

  if (eslint) {
    log.step('Prettier をセットアップ中...');
    runSilent('npm install -D prettier', targetDir);
    fs.writeFileSync(path.join(targetDir, '.prettierrc'), `{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
`);
  }
}

// ─── 完了メッセージ ──────────────────────────────────────

function printSuccess(projectName, options) {
  const { framework, tailwind, typescript, storybook, eslint, shadcn } = options;
  const tags = [
    chalk.magenta(framework),
    typescript && chalk.blue('TypeScript'),
    tailwind   && chalk.cyan('Tailwind'),
    shadcn     && chalk.yellow('shadcn/ui'),
    storybook  && chalk.green('Storybook'),
    eslint     && chalk.gray('ESLint+Prettier'),
  ].filter(Boolean).join(chalk.gray(' + '));

  console.log('\n' + chalk.bgGreen.black(' DONE ') + ' ' + chalk.bold(projectName) + chalk.gray(' が作成されました'));
  console.log(chalk.gray('  構成:'), tags);
  console.log('\n' + chalk.bold('  次のステップ:'));
  console.log(chalk.cyan(`    cd ${projectName}`));
  console.log(chalk.cyan('    npm run dev'));
  if (storybook) console.log(chalk.cyan('    npm run storybook'));
  console.log();
}

// ─── メインの対話フロー ──────────────────────────────────

async function main() {
  console.log('\n' + chalk.bold.cyan('◆ create-my-app') + chalk.gray('  プロジェクト雛形ジェネレーター\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'プロジェクト名:',
      default: 'my-app',
      validate: (v) => /^[a-z0-9-_]+$/.test(v) || '小文字・数字・ハイフンのみ使用可能です',
    },
    {
      type: 'list',
      name: 'framework',
      message: 'フレームワーク:',
      choices: [
        { name: 'Next.js  (App Router)', value: 'nextjs' },
        { name: 'React    (Vite)',        value: 'react' },
        { name: 'Vue 3    (Vite)',        value: 'vue' },
      ],
    },
    {
      type: 'confirm',
      name: 'typescript',
      message: 'TypeScript を使う?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'tailwind',
      message: 'TailwindCSS を追加する?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'shadcn',
      message: 'shadcn/ui を追加する?',
      default: false,
      when: (ans) => ans.tailwind && ans.framework !== 'vue',
    },
    {
      type: 'confirm',
      name: 'eslint',
      message: 'ESLint + Prettier を追加する?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'storybook',
      message: 'Storybook を追加する?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: (ans) => {
        const opts = [
          ans.framework === 'nextjs' ? 'Next.js' : ans.framework === 'react' ? 'React+Vite' : 'Vue+Vite',
          ans.typescript ? 'TypeScript' : 'JavaScript',
          ans.tailwind   ? 'Tailwind'   : null,
          ans.shadcn     ? 'shadcn/ui'  : null,
          ans.eslint     ? 'ESLint+Prettier' : null,
          ans.storybook  ? 'Storybook'  : null,
        ].filter(Boolean).join(' + ');
        return `\n  構成: ${chalk.cyan(opts)}\n  この内容でプロジェクトを作成しますか?`;
      },
      default: true,
    },
  ]);

  if (!answers.confirm) {
    log.warn('キャンセルしました');
    process.exit(0);
  }

  const { projectName, framework, typescript, tailwind, eslint, storybook } = answers;
  const shadcn = answers.shadcn || false;
  const targetDir = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(targetDir)) {
    log.error(`"${projectName}" ディレクトリがすでに存在します`);
    process.exit(1);
  }

  console.log();
  const spinner = ora(chalk.gray('セットアップを開始します...')).start();
  spinner.stop();

  try {
    const opts = { framework, typescript, tailwind, eslint, storybook, shadcn };

    if (framework === 'nextjs') {
      await createNextjs(projectName, opts, targetDir);
    } else if (framework === 'react') {
      await createReactVite(projectName, opts, targetDir);
    } else {
      await createVueVite(projectName, opts, targetDir);
    }

    printSuccess(projectName, opts);
  } catch (err) {
    log.error('エラーが発生しました:');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

program
  .name('create-my-app')
  .version(pkg.version)
  .description('対話型フロントエンドプロジェクトジェネレーター')
  .action(main);

program.parse(process.argv);