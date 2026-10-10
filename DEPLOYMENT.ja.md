# Cloudflare OS デプロイ手順

作業対象はこの公式 starter リポジトリだけです。
本体ソースは公式 starter が固定する `cloudflare-os/` submodule に含まれるため、隣に本体リポジトリを別途クローンする必要はありません。
公式の説明は [README の Deploy](README.md#deploy) と [Customization](docs/customization.md) を参照してください。
フォーク、専用の `env.sh`、コマンドラッパーは不要です。

## 前提

- Node.js 24.19 以上と `vp` を通常の PATH で使用できること
- 対象の Cloudflare account ID
- Workers、KV、R2、Browser Rendering、Dynamic Worker Loaders を利用できること
- 既定のモデル一覧を使う場合は Workers AI と AI Gateway も利用できること
- 公開 hostname と、その hostname を保護する Cloudflare Access application
- Access issuer、Application Audience (AUD) Tag、管理者メールアドレス

課金プラン、使用量制限、既存リソースとの名前の衝突を確認してください。
公開先は `https://cloudflare.totto2727.dev` に設定しています。
以下は Access と独自ドメインを使用する、公式 starter の既定構成です。
`totto2727.dev` が対象 Cloudflare アカウントの有効な zone であることを確認してください。

## 1. 作業ディレクトリと依存関係

ワークスペースのルートから移動し、公式コマンドで準備します。
既に依存関係が揃っている場合、インストールを繰り返す必要はありません。

```sh
cd fork/app/cloudflare-os-starter
git submodule update --init
vp install
vp -C cloudflare-os install
```

submodule を `--remote` で更新したり、別の最新 main で置き換えたりしないでください。
アップグレード時は [公式チェックリスト](docs/customization.md#upgrade) に従います。

## 2. Cloudflare Access と設定

1. `totto2727.dev` の Cloudflare zone と、既存の `cloudflare.totto2727.dev` DNS record との衝突がないことを確認します。
2. `cloudflare.totto2727.dev` の self-hosted Access application を確認し、本人や許可するユーザーだけが Allow policy に含まれることを確認します。
3. この application の AUD tag が、本人から提示された `cloudflareOsAccessAudience` と一致することを確認します。
4. [deployment.jsonc](deployment.jsonc) の `access.audience` はその AUD に設定済みです。Team domain と管理者メールも設定済みで、新規構築に必須の placeholder は残っていません。

| 設定 | 入力・確認する内容 |
| --- | --- |
| `accountId` | `5643a837ef66765e7881c0831a36ebed` に設定済み |
| `workers.*.name` | 下記の `cloudflare-os-*` 名に設定済み |
| `workers.router.route.customDomain` | `cloudflare.totto2727.dev` に設定済み |
| `publicBaseUrl` | 独自ドメインなら `null` のままで自動導出 |
| `access.issuer` | `https://totto2727.cloudflareaccess.com` に設定済み |
| `access.audience` | `a03b447e5b1f0875d39c832e3c5a1677677e8e900200bf820508fdcfcca8c1cb` に設定済み |
| `access.admins` | `kaihatu.totto2727@gmail.com` に設定済み |
| `customGatekeeper.name` / `message` | `totto2727` と公開 URL の案内文に設定済み。必要に応じて変更 |
| `aiGateway` | 同一アカウントの `iac-prod-ai-gateway`、provider は `cloudflare` に設定済み |
| `context.kvNamespaceId` / `resources.*` | Wrangler で確認した既存 ID・bucket 名に設定済み。別の新規環境で自動作成する場合だけ `null` |

設定済みの Worker 名は以下のとおりです。

| 役割 | Worker 名 |
| --- | --- |
| Router | `cloudflare-os-router` |
| Workshop | `cloudflare-os-workshop` |
| Context | `cloudflare-os-context` |
| Scheduler | `cloudflare-os-scheduler` |
| Custom Gatekeeper | `cloudflare-os-custom-gatekeeper` |
| Error Reporter | `cloudflare-os-error-reporter` |

`access.admins` はアプリの管理者設定であり、Access 側の入場制限の代わりではありません。
既定の同一アカウント Workers AI + AI Gateway binding ではモデル API token は不要ですが、無料であることを意味しません。
追加プロバイダーや別アカウントの AI Gateway を使う場合は、[公式の AI モデル設定](docs/customization.md#ai-models) に従います。

公式コマンドは `deployment.jsonc` を読みます。
生成される各 Worker の `wrangler.prod.jsonc` は手書きする必要がありません。
Worker 名、公開 URL、ストレージ ID はデータの帰属に関わるため、公開後は安易に変更しないでください。
`deployment.jsonc` は Git 管理対象なので、本人が確定した account ID、Access issuer・AUD・管理者メール、既存ストレージの接続先を入力した変更はコミットして保存します。
API token・署名シークレットなどの秘密情報はこの設定へ含めません。
公開 hostname、六つの Worker 名、Account ID、Access issuer・AUD・管理者メール、AI Gateway、Custom Gatekeeper の表示値は設定済みです。
必須の placeholder は残っていませんが、設定値の記録だけでは Cloudflare 側の利用権限や Access policy の正しさを保証しません。

### infra から参照した値と AUD

AI Gateway は `totto2727-org/monorepo` の production 環境に接続します。
[infra/cloudflare/src/ai-gateway.ts](https://github.com/totto2727-org/monorepo/blob/bd9defacfe4dcf749866ca1a660d00f17f932a53/infra/cloudflare/src/ai-gateway.ts) が `config.resourceName('ai-gateway')` を使用し、[src/config.ts](https://github.com/totto2727-org/monorepo/blob/bd9defacfe4dcf749866ca1a660d00f17f932a53/infra/cloudflare/src/config.ts) の命名規則が `production` を `prod` に置き換えるため、Gateway ID は `iac-prod-ai-gateway` です。
Account ID は infra の `cloudflare/production` 設定と本人から提示された ID が一致する値です。
設定ファイルの各値にも由来をコメントとして記載しています。
infra に Gateway が定義されていることと、実際にデプロイ済みで利用できることは別なので、モデルを使用する前に infra の production デプロイが完了していることを確認してください。

当初確認した [infra/cloudflare/index.ts](https://github.com/totto2727-org/monorepo/blob/526f38ff36956d5b46cdc82f09e8edba2efcd639/infra/cloudflare/index.ts) には Access Application やその AUD の出力がありませんでした。
その後、本人から `cloudflareOsAccessDomain = "cloudflare.totto2727.dev"` と `cloudflareOsAccessAudience = "a03b447e5b1f0875d39c832e3c5a1677677e8e900200bf820508fdcfcca8c1cb"` の出力が提示されたため、その domain と一致する Router の `access.audience` に保存しています。
AUD は Application ごとに発行される値なので、Team domain、Account ID、SAML group ID、別アプリの AUD から推測しません。
Application を再作成した場合は、その新しい AUD を本人が確認して設定へ反映してください。

この環境では作成済みの KV/R2 を再利用し、接続先を `deployment.jsonc` に明示的に保存しています。
Wrangler の `kv namespace list` と `r2 bucket list` で対象アカウントの存在を確認した値は次のとおりです。

| 設定 | 既存リソース名 | ID または bucket 名 |
| --- | --- | --- |
| `context.kvNamespaceId` | `cloudflare-os-context-context-collections` | `cc288190a12943ae92c3007fe43d5b0d` |
| `resources.blueprintsKvNamespaceId` | `cloudflare-os-workshop-blueprints` | `61bc53207ef4414694295d0dd700968b` |
| `resources.avatarsKvNamespaceId` | `cloudflare-os-workshop-avatars` | `821f16294b9c4f8a833589dba2b288a2` |
| `resources.blueprintContentBucket` | `cloudflare-os-workshop-blueprint-content` | `cloudflare-os-workshop-blueprint-content` |

別の新規環境を自動作成する場合は、ストレージ設定を `null` にして Wrangler の自動作成を利用できます。
Workers AI は同一アカウントの binding を使用します。
追加のモデルプロバイダーや Artifacts などを使う場合だけ、別途設定が必要です。

## 3. 本人が実行する認証・検証・デプロイ

このリポジトリ内で実行します。

```sh
vp exec wrangler login
vp run check
```

`vp run check` は公式のテスト、ビルド、Wrangler dry-run を行います。
placeholder が残っている場合は停止するので、設定を修正してから再実行してください。

確認が成功したら、本人が本番デプロイを実行します。

```sh
vp run deploy
```

既定では Error Reporter、Context、Scheduler、Custom Gatekeeper、Workshop、Router の六つの Worker を順番にデプロイします。
ストレージ設定が `null` なら Wrangler が三つの KV namespace と一つの R2 bucket を自動作成します。
現在の設定は既存リソースを指定しているため、それらを再利用します。
Router だけが公開ルートを持ち、ほかの Worker は service binding からアクセスされます。
この操作は Cloudflare のリソース変更と課金を伴う可能性があります。

## 4. デプロイ後の確認

- 公開 URL が Access 認証を要求し、許可したユーザーだけが入れること
- `/admin` に設定した管理者が入れ、一般ユーザーは管理者として扱われないこと
- Router 以外に不要な公開ルート・preview URL がないこと
- 管理画面からサイト名、ロゴ、Context・Scheduler・Custom Gatekeeper の有効化方針を設定できること
- 使用するモデルへの問い合わせ、Context の保存・再読込、Scheduler の予約実行が動作すること
- 各 Worker のログに設定や binding に関するエラーがないこと

## 公式資料

- [starter README](https://github.com/cloudflare/cloudflare-os-starter#deploy)
- [カスタマイズとアップグレード](https://github.com/cloudflare/cloudflare-os-starter/blob/main/docs/customization.md)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Workers の料金](https://developers.cloudflare.com/workers/platform/pricing/)
