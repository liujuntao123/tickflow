package com.tickflow.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import com.tickflow.app.feature.AppRoot
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private val openTaskId = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        openTaskId.value = intent?.getStringExtra(EXTRA_OPEN_TASK_ID)
        setContent {
            AppRoot(
                openTaskId = openTaskId.value,
                onOpenTaskConsumed = { openTaskId.value = null },
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        openTaskId.value = intent.getStringExtra(EXTRA_OPEN_TASK_ID)
    }

    companion object {
        /** 通知点击直达任务详情。 */
        const val EXTRA_OPEN_TASK_ID = "open_task_id"
    }
}