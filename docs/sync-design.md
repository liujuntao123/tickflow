# 同步协议设计

> 实现位置：`server/src/common/sync/`（seq 分配器、LWW）、`server/src/modules/sync/`（协议端）；
> 客户端：Android `core/sync/SyncEngine`（离线优先）、Web 走 REST。

## 核心不变量

**每用户单调 seq 计数器 + 事务开头行锁**：

```sql
BEGIN;
SELECT seq FROM user_sync_state WHERE user_id = $1 FOR UPDATE;  -- 行锁持有至 commit
-- 所有写操作分配 seq（=++current）
UPDATE user_sync_state SET seq = $n WHERE user_id = $1;
COMMIT;
```

行锁必须在**事务开头**获取：分配顺序 = 提交顺序，客户端游标（`seq > cursor` 增量拉取）不会出现空洞（否则先提交的大 seq 会让中间读取的客户端永久漏掉后提交的小 seq）。

**所有写路径统一**：REST CRUD 与 `/sync` 推送都经由同一分配器（`withSync`），包括重复任务的完成滚动（`rollRecurringTask`，两路径共享同一函数）。

## 实体级 LWW

- 每张可同步表带 `lww_at`（逻辑修改时间，客户端提供、服务端钳制到 `now+2min`）与 `lww_device`
- 比较键：`(lww_at, lww_device)` 字典序，大者胜；REST 写入取 `now()/'server'`
- 客户端上送 `updatedAt` 即其本地逻辑时间；被判定为旧版本的进入 `skippedOlder`

## 墓碑与首次同步

- 删除 = 软删（`deletedAt` + 新 seq），随增量下发；客户端据此删除本地行
- 客户端本地删除记录墓碑，随下次推送上送；确认后清除（30 天未确认放弃）
- **首同步两阶段**：`cursor=0` 且服务端已有数据且客户端本次带了实体 → 返回 `needsFullResync: true` 且**不应用**任何客户端数据（防止本地种子数据时间戳更新反噬云端）；服务端为空则正常上行
- 任何 `needsFullResync` → 客户端清空本地缓存后 `GET /sync/bootstrap` 全量重建再合并

## 重复任务的滚动

- 完成重复任务（REST complete 或 /sync 推送 status=2）：服务端写 `task_occurrences` 历史，任务保持未完成并把 `dueDate/nextDueDate` 推进到下一次（规则终态则按普通完成）
- 撤销完成：回退到最近一条 occurrence 的日期并删除该条历史
- 日历视图在服务端用同一 RRULE 展开（窗口 ≤92 天，不落库）；三端共享 `packages/contracts/test/rrule-vectors.json` 校验

## 已知边界

- 单用户写串行化（行锁）——个人应用规模可接受
- 日历展开时区按「UTC 构造 + 本地日期分组」简化，不含夏令时偏移修正
- 不使用操作日志（状态基同步天然幂等，客户端无需可靠 op 队列）