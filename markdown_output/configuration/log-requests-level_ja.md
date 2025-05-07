# 完了したリクエストのログ記録を設定する

Vault は、`log_requests_level` 設定パラメータを使用して、完了したリクエストのログ記録を設定できます。

## リクエストの完了したログの有効化

デフォルトでは、完了したリクエストのログ記録は無効になっています。リクエストのログ記録を有効にするには、Vaultサーバー設定で `log_requests_level` 設定オプションを希望のログレベルに設定します。許容されるログレベルは `error`、`warn`、`info`、`debug`、`trace`、および `off`（デフォルト）です。

完了したリクエストは、Vaultのログレベルにこのログレベルが含まれている場合、設定されたレベルでログに記録されます。例えば、`log_level` が `debug` に設定されているが、`log_requests_level` が `trace` に設定されている場合、完了したリクエストはログに記録されません。

Vaultサーバーが既に実行中の場合でも、Vaultサーバー設定でパラメータを設定し、Vaultプロセスに `SIGHUP` シグナルを送信することができます。

```hcl
log_requests_level = "debug"
log_level = "debug"

listener "tcp" {
  # ...
}
```

# 完了したリクエストのログ記録の無効化

完了したリクエストのログ記録を無効化するには、Vaultサーバーの設定から `log_requests_level` 設定パラメータを単純に削除するか、`off` に設定し、Vaultプロセスに `SIGHUP` シグナルを送信します。

```hcl
log_requests_level = "off"
log_level = "debug"

listener "tcp" {
  # ...
}
```