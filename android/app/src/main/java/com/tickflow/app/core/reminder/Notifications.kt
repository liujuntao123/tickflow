package com.tickflow.app.core.reminder

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.tickflow.app.MainActivity
import com.tickflow.app.R

object Notifications {

    const val CHANNEL_REMINDER = "reminders"
    const val CHANNEL_FOCUS = "focus"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_REMINDER, "任务提醒", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "任务到期与自定义提前提醒"
            }
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_FOCUS, "专注", NotificationManager.IMPORTANCE_LOW).apply {
                description = "番茄钟提醒（预留）"
            }
        )
    }

    fun postReminder(context: Context, taskId: String, title: String, subtitle: String?) {
        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) return

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(MainActivity.EXTRA_OPEN_TASK_ID, taskId)
        }
        val pending = PendingIntent.getActivity(
            context,
            taskId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val body = subtitle ?: "任务提醒"
        val notification = NotificationCompat.Builder(context, CHANNEL_REMINDER)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pending)
            .build()

        runCatching { manager.notify(taskId.hashCode(), notification) }
    }
}