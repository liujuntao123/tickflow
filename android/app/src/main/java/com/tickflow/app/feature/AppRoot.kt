package com.tickflow.app.feature

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tickflow.app.feature.auth.AuthScreen
import com.tickflow.app.feature.main.MainScreen
import com.tickflow.app.ui.theme.TickFlowTheme

@Composable
fun AppRoot(viewModel: AppViewModel = hiltViewModel()) {
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
                else -> MainScreen(onSync = viewModel::syncNow)
            }
        }
    }

    // 回前台时立即同步
    LifecycleEventEffect(Lifecycle.Event.ON_START) {
        if (current?.loggedIn == true) viewModel.syncNow()
    }
}