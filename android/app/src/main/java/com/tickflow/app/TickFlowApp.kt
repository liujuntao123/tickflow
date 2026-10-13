package com.tickflow.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.tickflow.app.core.reminder.Notifications
import com.tickflow.app.core.reminder.ReminderScheduler
import com.tickflow.app.core.repository.AuthRepository
import com.tickflow.app.core.sync.SyncScheduler
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class TickFlowApp : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var authRepository: AuthRepository
    @Inject lateinit var syncScheduler: SyncScheduler
    @Inject lateinit var reminderScheduler: ReminderScheduler

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        // 通知渠道尽早创建（提醒 + 番茄预留）
        Notifications.ensureChannels(this)
        appScope.launch {
            // 冷启动：把 DataStore 中的服务器地址 / token 载入内存供拦截器使用
            authRepository.initRuntime()
            syncScheduler.ensurePeriodic()
            if (authRepository.isLoggedIn()) {
                // 重建提醒并触发同步
                runCatching { reminderScheduler.rescheduleAll() }
                syncScheduler.requestImmediate()
            }
        }
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}