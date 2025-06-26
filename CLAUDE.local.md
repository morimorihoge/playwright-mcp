# Playwright MCP プロジェクト調査メモ

## プロジェクト概要
- **名称**: @playwright/mcp (Playwright MCP Server)
- **説明**: Model Context Protocol (MCP) サーバーとして、Playwrightを使用したブラウザ自動化機能を提供
- **バージョン**: 0.0.29
- **リポジトリ**: https://github.com/microsoft/playwright-mcp.git
- **ライセンス**: Apache-2.0
- **作者**: Microsoft Corporation

## 主な特徴
- **高速・軽量**: Playwrightのアクセシビリティツリーを使用（ピクセルベースの入力不要）
- **LLMフレンドリー**: ビジョンモデル不要、構造化データで動作
- **決定論的なツール適用**: スクリーンショットベースのアプローチに見られる曖昧さを回避

## 技術スタック
### 主要な依存関係
- **playwright**: 1.53.0 - ブラウザ自動化の中核
- **@modelcontextprotocol/sdk**: ^1.11.0 - MCPプロトコル実装
- **commander**: ^13.1.0 - CLIフレームワーク
- **TypeScript**: ^5.8.2 - 開発言語
- **Node.js**: 18以上が必要

### その他の依存関係
- **ws**: ^8.18.1 - WebSocket実装
- **debug**: ^4.4.1 - デバッグユーティリティ
- **mime**: ^4.0.7 - MIMEタイプ処理
- **zod-to-json-schema**: ^3.24.4 - スキーマ変換

## プロジェクト構造
```
playwright-mcp/
├── src/                    # TypeScriptソースコード
│   ├── tools/             # 各種ツール実装
│   │   ├── snapshot.ts    # アクセシビリティスナップショット
│   │   ├── vision.ts      # ビジョンモード（スクリーンショット）
│   │   ├── navigate.ts    # ナビゲーション
│   │   ├── keyboard.ts    # キーボード操作
│   │   └── ...           # その他のツール
│   ├── index.ts          # エントリーポイント
│   ├── server.ts         # MCPサーバー実装
│   ├── connection.ts     # 接続管理
│   └── context.ts        # ブラウザコンテキスト管理
├── tests/                # Playwrightテスト
├── extension/            # Chrome拡張機能
├── utils/               # ユーティリティスクリプト
└── examples/            # 使用例
```

## 提供される主要機能

### 1. インタラクション機能
- browser_snapshot: ページのアクセシビリティスナップショット取得
- browser_click: 要素のクリック
- browser_type: テキスト入力
- browser_drag: ドラッグ&ドロップ
- browser_hover: ホバー操作
- browser_select_option: ドロップダウン選択
- browser_press_key: キーボード操作

### 2. ナビゲーション機能
- browser_navigate: URL遷移
- browser_navigate_back/forward: 戻る/進む

### 3. リソース管理
- browser_take_screenshot: スクリーンショット撮影
- browser_pdf_save: PDF保存
- browser_network_requests: ネットワークリクエスト一覧
- browser_console_messages: コンソールメッセージ取得

### 4. タブ管理
- browser_tab_list: タブ一覧
- browser_tab_new: 新規タブ
- browser_tab_select: タブ選択
- browser_tab_close: タブ閉じる

### 5. その他
- browser_install: ブラウザインストール
- browser_close: ブラウザ終了
- browser_resize: ウィンドウサイズ変更
- browser_wait_for: 待機処理
- browser_file_upload: ファイルアップロード
- browser_handle_dialog: ダイアログ処理

## 動作モード
1. **スナップショットモード（デフォルト）**: アクセシビリティスナップショットを使用
2. **ビジョンモード**: `--vision`フラグでスクリーンショットベースの操作

## ビルド・開発コマンド
- `npm run build`: TypeScriptビルド
- `npm run lint`: ESLint + TypeScriptチェック
- `npm test`: Playwrightテスト実行
- `npm run watch`: 開発時の自動ビルド
- `npm run run-server`: サーバー起動

## 設定方法
MCPクライアント（VS Code、Cursor、Claude Desktop等）での設定例：
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

## メモ
- エクステンション機能もあり（Chrome拡張として動作可能）
- Docker対応（ヘッドレスChromiumのみ）
- SSEトランスポート対応（ポート指定で独立サーバーとして動作可能）
- プログラマティックな使用も可能（ライブラリとして）