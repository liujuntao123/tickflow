package com.tickflow.app.feature.focus

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.tickflow.app.MainActivity
import com.tickflow.app.R
import com.tickflow.app.core.reminder.Notifications
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * 番茄计时前台服务：常驻通知显示剩余时间，带「暂停/继续」「放弃」两个 action。
 * 计时权威在 [FocusViewModel]；本服务只负责渲染与转发按钮事件。
 * 计时结束/放弃后由 ViewModel 停止本服务。
 */
class FocusTimerService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var observing = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Notifications.ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "专注"
                val remaining = intent.getIntExtra(EXTRA_REMAINING, 0)
                val running = intent.getBooleanExtra(EXTRA_RUNNING, true)
                startForegroundSafely(buildNotification(title, format(remaining), running))
                if (!observing) {
                    observing = true
                    observeTick()
                }
            }
            ACTION_PAUSE -> FocusTimerController.emit(FocusTimerController.Event.Pause)
            ACTION_RESUME -> FocusTimerController.emit(FocusTimerController.Event.Resume)
            ACTION_GIVE_UP -> FocusTimerController.emit(FocusTimerController.Event.GiveUp)
            ACTION_STOP -> stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun observeTick() {
        scope.launch {
            FocusTimerController.tick.collect { tick ->
                if (tick == null) {
                    stopSelf()
                    return@collect
                }
                val manager = NotificationManagerCompat.from(this@FocusTimerService)
                if (manager.areNotificationsEnabled()) {
                    runCatching {
                        manager.notify(
                            NOTIFICATION_ID,
                            buildNotification(tick.title, format(tick.remainingSeconds), tick.running),
                        )
                    }
                }
            }
        }
    }

    private fun startForegroundSafely(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(title: String, remaining: String, running: Boolean): Notification {
        val contentIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val toggleAction = if (running) ACTION_PAUSE else ACTION_RESUME
        val toggleIntent = PendingIntent.getService(
            this, 1,
            Intent(this, FocusTimerService::class.java).setAction(toggleAction),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val giveUpIntent = PendingIntent.getService(
            this, 2,
            Intent(this, FocusTimerService::class.java).setAction(ACTION_GIVE_UP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, Notifications.CHANNEL_FOCUS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(remaining)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setContentIntent(contentIntent)
            .addAction(0, if (running) "暂停" else "继续", toggleIntent)
            .addAction(0, "放弃", giveUpIntent)
            .build()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val ACTION_START = "com.tickflow.app.focus.START"
        const val ACTION_PAUSE = "com.tickflow.app.focus.PAUSE"
        const val ACTION_RESUME = "com.tickflow.app.focus.RESUME"
        const val ACTION_GIVE_UP = "com.tickflow.app.focus.GIVE_UP"
        const val ACTION_STOP = "com.tickflow.app.focus.STOP"
        const val EXTRA_TITLE = "title"
        const val EXTRA_REMAINING = "remaining"
        const val EXTRA_RUNNING = "running"
        private const val NOTIFICATION_ID = 2001

        fun format(seconds: Int): String {
            val s = seconds.coerceAtLeast(0)
            return "%02d:%02d".format(s / 60, s % 60)
        }
    }
}