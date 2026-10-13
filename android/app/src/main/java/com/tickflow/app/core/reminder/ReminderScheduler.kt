package com.tickflow.app.core.reminder

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.tickflow.app.core.database.ListDao
import com.tickflow.app.core.database.ScheduledAlarmDao
import com.tickflow.app.core.database.ScheduledAlarmEntity
import com.tickflow.app.core.database.TaskDao
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.core.database.effectiveDue
import com.tickflow.app.core.util.TimeUtils
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 提醒调度：
 * - 重算所有「未完成 + 有有效到期 + reminders 非空」任务的下一次提醒时刻（due - offset 分钟），写入 Room；
 * - 只注册**一个聚合 AlarmManager 闹钟**（最近的一条）；
 * - 触发后发通知并重排下一条。
 */
@Singleton
class ReminderScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
    private val taskDao: TaskDao,
    private val listDao: ListDao,
    private val alarmDao: ScheduledAlarmDao,
) {

    suspend fun rescheduleAll() {
        val now = System.currentTimeMillis()
        val lists = listDao.all().associate { it.id to it.name }
        val candidates = taskDao.reminderCandidates()

        val alarms = candidates.mapNotNull { task ->
            task.toAlarm(now, lists)
        }
        alarmDao.clear()
        if (alarms.isNotEmpty()) alarmDao.upsertAll(alarms)
        scheduleNextAlarm()
    }

    /** 闹钟触发：发出所有已到期提醒，然后重排。 */
    suspend fun onAlarmFired() {
        val now = System.currentTimeMillis()
        alarmDao.due(now).forEach { alarm ->
            Notifications.postReminder(context, alarm.taskId, alarm.title, alarm.subtitle)
        }
        rescheduleAll()
    }

    private fun TaskEntity.toAlarm(now: Long, lists: Map<String, String>): ScheduledAlarmEntity? {
        val dueMillis = TimeUtils.parseIso(effectiveDue)?.time ?: return null
        val offsets = reminders?.map { it.offset }?.distinct()?.sorted() ?: return null
        if (offsets.isEmpty()) return null
        val trigger = offsets
            .map { dueMillis - it * 60_000L }
            .filter { it >= now }
            .minOrNull() ?: return null
        return ScheduledAlarmEntity(
            taskId = id,
            triggerAt = trigger,
            title = title,
            subtitle = buildSubtitle(this, lists),
        )
    }

    private fun buildSubtitle(task: TaskEntity, lists: Map<String, String>): String {
        val parts = mutableListOf<String>()
        TimeUtils.displayDue(task.effectiveDue)?.let { parts.add(it) }
        lists[task.listId]?.let { parts.add(it) }
        return if (parts.isEmpty()) "任务提醒" else parts.joinToString(" · ")
    }

    private suspend fun scheduleNextAlarm() {
        val next = alarmDao.next()
        val manager = context.getSystemService(AlarmManager::class.java) ?: return
        val pending = broadcastPendingIntent()
        if (next == null) {
            manager.cancel(pending)
            return
        }
        val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
        if (canExact) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.triggerAt, pending)
        } else {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.triggerAt, pending)
        }
    }

    private fun broadcastPendingIntent(): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).setAction(ACTION_REMINDER)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    companion object {
        const val ACTION_REMINDER = "com.tickflow.app.action.REMINDER"
        const val REQUEST_CODE = 1001
    }
}