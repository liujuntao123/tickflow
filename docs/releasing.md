# 发版指南

## 版本号规则

- 语义化版本 `vX.Y.Z`；`versionCode = X*10000 + Y*100 + Z`（严格单调，防「应用未安装」）
- 预发布（带 `-`）自动附加 `run_number % 100` 偏移，避免与正式版撞号

## 一次发版做什么

```bash
git tag v1.0.0 && git push origin v1.0.0
```

触发三条流水线：

| 工作流 | 产物 |
|---|---|
| `ci.yml`（main push） | server/web 构建 + android assembleDebug |
| `android-release.yml`（tag v*） | 签名 APK → GitHub Release（证书指纹写入 Release 说明） |
| `docker-publish.yml`（tag v*） | `ghcr.io/liujuntao123/tickflow-server|web:<version>` 与 `:latest` |

## Android 签名

- keystore：`tickflow-release.jks`（RSA 4096 / 30 年），**仓库外双备份**（本地 `tools/tickflow-keystore` 与个人备份目录）
- GitHub Secrets（4 个）：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`
- CI 注入逻辑：有密钥 → release 签名；缺密钥 → 回落 debug 签名并把产物命名 `-debugsigned.apk` 且显著标注
- 每次 Release 正文包含 `apksigner verify --print-certs` 输出，用于比对签名是否漂移
- **keystore 或密码丢失将无法覆盖安装升级，务必备份**

## 手动触发

- Android：Actions → Android Release → Run workflow，输入版本号（不含 v）
- 镜像：Actions → Publish Docker Images → Run workflow，输入版本号

## 发布后检查

1. `gh release view vX.Y.Z` 确认 APK 资产与体积合理（约 12-13MB）
2. Release 说明中的证书指纹与上次一致
3. `docker compose` 拉起后 `/api/v1/healthz` 200
4. 真机安装覆盖升级正常（同签名）