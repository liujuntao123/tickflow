package com.tickflow.app.core.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val syncEngine: SyncEngine,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = when (val outcome = syncEngine.sync()) {
        is SyncOutcome.Success -> Result.success()
        SyncOutcome.NotLoggedIn -> Result.success()
        is SyncOutcome.Failure -> if (runAttemptCount < 3) Result.retry() else Result.failure()
    }
}