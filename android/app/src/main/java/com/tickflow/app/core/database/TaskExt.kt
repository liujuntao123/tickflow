package com.tickflow.app.core.database

/**
 * 有效到期时间：优先 next_due_date（重复任务滚动后的下一次），否则 due_date。
 * 与后端 views 的 `COALESCE(next_due_date, due_date)` 语义保持一致。
 */
val TaskEntity.effectiveDue: String?
    get() = nextDueDate ?: dueDate