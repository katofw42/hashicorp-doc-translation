# Vaultとは何か?

Vaultは、オンプレミス、クラウド、またはハイブリッド環境においてシステムをデプロイする際に、ミッションクリティカルなデータのための一元化された、十分な監査機能を持つ特権アクセスとシークレット管理を提供します。

モジュラーデザインと成長中のプラグインエコシステムに基づいて、Vaultは既存のシステムと統合し、アプリケーションワークフローをカスタマイズすることができます。

# なぜ Vault を使用するべきなのか？

最新のソフトウェアは**シークレット**によって動作しています。シークレットとは、認証情報、暗号化キー、認証証明書、およびアプリケーションを一貫かつ安全に実行するために必要な他の重要な情報といった、機密性の高い、個別の情報のことです。

Vault はシークレット管理を一元化することで、アプリケーションをより堅牢にします。Vault を使用すると、以下のことができます：

- [静的シークレットの管理](/vault/docs/about-vault/why-use-vault/static-secrets)
- [証明書の管理](/vault/docs/about-vault/why-use-vault/certificates)
- [アイデンティティと認証の管理](/vault/docs/about-vault/why-use-vault/identities)
- [サードパーティのシークレットの管理](/vault/docs/about-vault/why-use-vault/3rd-party-secrets)
- [機密データの管理](/vault/docs/about-vault/why-use-vault/sensitive-data)
- [規制コンプライアンスのサポート](/vault/docs/about-vault/why-use-vault/regulatory-compliance)

> **HCP Vault Dedicated をお試しください**
> 
> HCP Vault Dedicated は、自己管理型 Vault Enterprise と同じバイナリを使用してクラウド上で Vault を実行します。デプロイクラスターやサーバーの管理の手間なく、一貫したユーザーエクスペリエンスを提供します。
> 
> [HCP Vault Dedicated にサインアップ](https://portal.cloud.hashicorp.com)するか、詳細については [HCP Vault Dedicated のチュートリアル](/vault/tutorials/cloud)をご覧ください。

# プラグインとは何か?

プラグインは、Vaultにおける構成要素であり、データの移動方法と、クライアントがそのデータにアクセスする方法を制御できるようにします。

[プラグインエコシステム](/vault/docs/plugins)には以下のものが含まれます:
- Vaultへのクライアントアクセスを制御し、認証フローを処理する認証プラグイン。
- 機密情報を生成、保存、管理、または変換する一般的なシークレットプラグイン。
- クライアントがデータベースデータにアクセスするために使用する動的な認証情報を管理するデータベースシークレットプラグイン。

[厳選されたプラグインレジストリ](/vault/integrations)からプラグインを使用するか、[カスタムプラグインを構築](/vault/docs/plugins/plugin-development)して、ワークフローに最適な方法でVaultを統合します。

# Vaultのデータにアクセスできるのは誰ですか?

Vaultは保存データを暗号化し、設定可能で堅牢な[認証](/vault/docs/concepts/auth)および[認可](/vault/docs/concepts/policies)方式によってそのデータへのアクセスを制御します。

[Vaultの仕組み画像]

1. クライアントは、手動で生成されたトークン、LDAP、Azure、AWSなどのサードパーティプロバイダーのようなプロトコルで認証を行います。
2. Vaultは、クライアントリクエストを内部エンティティと適用可能なセキュリティポリシーにリンクするアクセストークンを生成します。
3. クライアントは、Vaultにマウントされたリソースパスに基づいて、シークレットと暗号化操作を操作します。
4. Vaultは、リソースパスに設定されたポリシーに対してクライアントリクエストを認可し、それに応じてアクセスを許可または拒否します。

このプロセス全体を通じて、Vaultは認証や認可の成否に関わらず、すべての活動を監査するため、ミッションクリティカルなシステムとのやり取りを追跡できます。

# Vaultのデータ保存場所

Vaultは、耐久性のある情報ストレージに関して、さまざまなオプションをサポートしています。

| ストレージタイプ | HAサポート | 説明 |
|-------------|------------|-------------|
| [統合ストレージ](/vault/docs/configuration/storage/raft) | はい | データを運用中のVaultクラスター全体で暗号化およびレプリケーションする「組み込み」ストレージオプション。 |
| [ファイルシステム](/vault/docs/configuration/storage/filesystem) | いいえ | Vaultを実行しているマシンのローカルファイルシステムにデータを永続化します。 |
| [外部](/vault/docs/configuration/storage#integrated-vs-external) | 場合による | Azure、AWS、Google Cloud、MySQLなどの耐久性のある第三者ストレージシステム。 |
| [メモリ内](/vault/docs/configuration/storage/in-memory) | いいえ | 開発と実験のため、Vaultを実行しているマシン上でデータを完全にメモリ内に永続化します。 |

ほとんどのデプロイメントでは、統合ストレージをお勧めします。統合ストレージは、Vaultがデータアクセスのセキュリティと追跡可能性を検証できない第三者システムに依存することなく、バックアップ/リストアワークフロー、高可用性、Enterprise レプリケーション機能をサポートします。

## Vaultを使用すべきでない場合

Vaultは堅牢、パワフル、そして柔軟です。しかし、シークレット管理のニーズが限定的または単純な場合は、煩雑に感じることもあります。

組織がシークレット管理を始めたばかりであるか、既存のシークレット管理プロセスを簡素化しようとしている場合は、Vaultの代わりに [HCP Vault Secrets](/hcp/docs/vault-secrets) から始めることを検討してください。

HCP Vault Secretsは、安全で柔軟なアクセス制御モデルを提供するHashiCorp クラウドプラットフォーム上のSaaSサービスです。最小権限の原則に基づき、HCP Vault Secretsは、漏洩したシークレットに関連するリスクを軽減するために、シングルプラットフォームを通じてシークレットのライフサイクル管理を処理します。

# Vault の入手方法

[事前にコンパイルされたバイナリとしてVault をダウンロード](http://releases.hashicorp.com/vault)、公式の[コミュニティ](/vault/install)または[エンタープライズ](/vault/install/enterprise)パッケージをサポートされているパッケージマネージャーでインストール、または GitHub の Vault コミュニティリポジトリをクローンして[ソースコードからVaultをビルド](/vault/get-vault/build-from-code)できます。

Vault Enterprise の機能を使用するには、[有効なライセンスを設定](/vault/license)する必要があります。

[GitHub、YouTube、LinkedIn リンク]