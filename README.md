Focus Guard - 簡易セットアップ手順 (Windows)
動作環境
OS: Windows 11（動作確認済み）
ブラウザ: Google Chrome
リポジトリをローカルにクローン済み
OpenAI API Key（必須）

セットアップ手順（Windows PowerShell 使用）
1. PowerShell を 2 つ開く
タブ1: バックエンド用
タブ2: 拡張機能のビルド用

2. バックエンドの起動
バックエンド用タブで以下を実行：

cd C:\Users\<ユーザー名>\focus-guard
$env:OPENAI_API_KEY="sk-..."   # OpenAI APIキーを入力
$env:FG_B_MODEL="gpt-4o-mini"
$env:FG_DEBUG="1"
pnpm --dir apps/backend dev


実行後の想定出力例：

[FG-backend] boot
[FG-backend] thresholds: { allow: 0.6, block: 0.6, ... }
[FG-boot] {"bModel":"gpt-4o-mini","thresholds":{...},"openaiKeySet":true}
[FG-backend] listening on :8787

3. 拡張機能のビルド
拡張機能ビルド用タブで以下を実行：

cd C:\Users\<ユーザー名>\focus-guard
pnpm --dir apps/extension build


実行後の想定出力例：

vite v7.1.3 building for production...
✓ 10 modules transformed.
dist/manifest.json
dist/src/ui/start.html
dist/assets/...
✓ built in XXXms

4. Chrome に拡張機能を読み込む
Chrome を起動
アドレスバーに chrome://extensions/ を入力して拡張機能管理画面へ
右上の デベロッパーモード を有効化
「パッケージ化されていない拡張機能を読み込む」をクリック
フォルダを選択：
C:\Users\<ユーザー名>\focus-guard\apps\extension\dist

5. 完了 
これで拡張機能が Chrome に読み込まれ、バックエンド（http://localhost:8787）と通信可能になります。

補足
<ユーザー名> は自分の Windows ユーザー名に置き換えてください。
APIキーは本番用ではなく、ハッカソン用に発行したものを利用してください。
もしポートが使用中でエラーになる場合は、バックエンドのポート番号を変更してください。
