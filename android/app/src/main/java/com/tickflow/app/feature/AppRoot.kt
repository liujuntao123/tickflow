package com.tickflow.app.feature

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tickflow.app.feature.auth.AuthScreen
import com.tickflow.app.feature.main.MainScreen
import com.tickflow.app.ui.theme.TickFlowTheme

@Composable
fun AppRoot(
    openTaskId: String? = null,
    onOpenTaskConsumed: () -> Unit = {},
    viewModel: AppViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val current = state

    val darkTheme = when (current?.theme) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }

    TickFlowTheme(darkTheme = darkTheme) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when {
                current == null -> Box(Modifier.fillMaxSize())
                !current.loggedIn -> AuthScreen()
                else -> MainScreen(
                    onSync = viewModel::syncNow,
                    openTaskId = openTaskId,
                    onOpenTaskConsumed = onOpenTaskConsumed,
                )
            }
        }
    }

    // 回前台时立即同步
    LifecycleEventEffect(Lifecycle.Event.ON_START) {
        if (current?.loggedIn == true) viewModel.syncNow()
    }

    // 首次登录后引导通知运行时权限（仅一次）
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }
    LaunchedEffect(current?.loggedIn) {
        if (current?.loggedIn == true && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted && viewModel.shouldAskNotifPermission()) {
                viewModel.markNotifPermissionAsked()
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}