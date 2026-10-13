# TickFlow Android 客户端

滴答清单风格复刻的 Android 原生客户端（Kotlin + Jetpack Compose）。本目录为单 module 工程（`:app`），
通过 `POST /sync` 与后端进行状态基同步。

## 技术栈

- Kotlin 2.0.21 / AGP 8.7.3 / Gradle 8.9 / compileSdk 35 / minSdk 24
- Jetpack Compose（BOM 2024.10.01）+ Material 3
- Hilt 2.52（KSP）、Room 2.6.1、DataStore 1.1.1
- Retrofit 2.11.0 + kotlinx-serialization 1.7.3、OkHttp 4.12.0
- WorkManager 2.9.1、Navigation Compose 2.8.4

## 本地构建

前置：已安装 JDK 17+（CI 使用 21）、Android SDK（platform-tools / platforms;android-35 / build-tools;35.0.0）。
`android/local.properties` 需指向本机 SDK：

```properties
sdk.dir=C\:\\Users\\<you>\\tools\\android-sdk
```

常用命令（工作目录 `android/`）：

```powershell
# Debug 构建
.\gradlew :app:assembleDebug --no-daemon

# Release 构建（本地未配置签名环境变量时自动回落 debug 签名，属预期）
.\gradlew :app:assembleRelease --no-daemon
```

产物：

- Debug：`app/build/outputs/apk/debug/app-debug.apk`
- Release：`app/build/outputs/apk/release/app-release.apk`

安装（有设备/模拟器时）：

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
```

### 依赖源

`settings.gradle.kts` 优先使用阿里云镜像、`google()` 兜底；GitHub CI 可直连 google，同样可构建。

### Release 签名

`app/build.gradle.kts` 通过环境变量注入签名，缺省回落 debug 签名（CI 依赖此逻辑，勿改）：

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

版本号通过 `-PversionName=` / `-PversionCode=` 注入。

## 服务器地址配置

后端默认监听 `http://127.0.0.1:3000`，API 前缀 `/api/v1`。

- **模拟器**：默认 `http://10.0.2.2:3000`（`10.0.2.2` 指向宿主机）。
- **真机**：登录页/设置页把「服务器地址」改为电脑的局域网 IP，如 `http://192.168.1.5:3000`，
  并确保手机与电脑同一网段、电脑防火墙放行 3000 端口。

服务器地址保存在 DataStore，并写入运行期配置供 OkHttp 拦截器改写请求 host，
无需重新构建即可切换后端。

## 架构与目录

```
app/src/main/java/com/tickflow/app/
├── MainActivity.kt / TickFlowApp.kt        # 入口、Application（Hilt + WorkManager 配置）
├── core/
│   ├── network/                            # Retrofit/OkHttp/DTO/动态 baseUrl/401 静默刷新
│   ├── database/                           # Room 镜像表、DAO、转换器、DTO↔Entity 映射
│   ├── datastore/                          # deviceId / token / serverUrl / cursor / 主题 / 用户
│   ├── sync/                               # SyncEngine（推送+拉取+bootstrap）、WorkManager 调度
│   ├── repository/                         # 本地优先的仓库层
│   └── util/                               # 时间工具（固定精度 UTC ISO，可字典序比较）
├── feature/                                # auth / main(导航+抽屉) / tasks / settings
└── ui/theme/                               # 颜色、字体、主题（深色跟随系统 + 手动切换）
```

## 同步要点（对齐 `docs/api.md`）

- 本地写操作立即置 `dirty=1`，删除写 `tombstones`，随后 `OneTimeWorkRequest` 立即同步；
  另有 15 分钟周期兜底 + 冷启动/回前台立即同步。
- 推送：dirty 实体 + 墓碑打包进 `POST /sync`；成功后清除 dirty（仅当自推送后未被再次修改）与墓碑。
- 拉取：保存 `cursor` 增量拉取；回包实体直接覆盖本地（后端 LWW 为准），仍 dirty 的本地更新保留。
- 首同步：本地无数据直接拉取；服务端为空则本地种子上云。
- `needsFullResync=true`：清空非 dirty 缓存后 `GET /sync/bootstrap` 全量重建。
- BigInt（`seq` / `sortOrder`）后端以**字符串**返回，客户端用 String 接收后转 Long。

## M1 范围

- 底部导航 5 项：任务 / 日历 / 专注 / 习惯 / 更多；后三者与「更多」为占位页（设置页已完成）。
- 任务页：智能清单 chips、任务列表、勾选乐观更新、FAB 快速添加、任务详情（标题/备注/优先级/截止/标签/子任务/删除）。
- 权限仅 `INTERNET`；通知/闹钟（AlarmManager）在 M2 接入（见 `core/sync` 与 `feature/tasks` 的写入点）。