package com.tickflow.app.feature.focus

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tickflow.app.core.database.TaskEntity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FocusScreen(viewModel: FocusViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tasks by viewModel.tasks.collectAsStateWithLifecycle()
    var showConfig by remember { mutableStateOf(false) }
    var showTaskPicker by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            viewModel.consumeMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("专注") },
                actions = {
                    IconButton(onClick = { showConfig = true }) {
                        Icon(Icons.Filled.Tune, contentDescription = "番茄配置")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(8.dp))

            val selectedTitle = tasks.firstOrNull { it.id == state.selectedTaskId }?.title
            TextButton(onClick = { showTaskPicker = true }) {
                Text(
                    text = selectedTitle?.let { "关联任务：$it" } ?: "关联任务：未选择",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            Spacer(Modifier.height(12.dp))
            val fraction = if (state.totalSeconds > 0) {
                state.remainingSeconds.toFloat() / state.totalSeconds.toFloat()
            } else {
                0f
            }
            TimerRing(
                remainingFraction = fraction,
                active = state.active,
                modifier = Modifier.size(260.dp),
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = state.phase.label,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = FocusTimerService.format(state.remainingSeconds),
                        style = MaterialTheme.typography.displaySmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = "共 ${state.totalSeconds / 60} 分钟",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(20.dp))
            if (!state.active) {
                Button(
                    onClick = viewModel::startFocus,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                ) { Text("开始专注") }
            } else {
                val isBreak = state.phase != FocusPhase.FOCUS
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Button(onClick = viewModel::togglePause, modifier = Modifier.weight(1f)) {
                        Text(if (state.running) "暂停" else "继续")
                    }
                    Button(onClick = viewModel::completeNow, modifier = Modifier.weight(1f)) {
                        Text(if (isBreak) "跳过休息" else "完成")
                    }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = viewModel::giveUp, modifier = Modifier.fillMaxWidth()) {
                    Text(if (isBreak) "结束休息" else "放弃")
                }
            }

            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("今日", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                text = "专注 ${state.todaySeconds / 60} 分钟 · ${state.todayCount} 个番茄",
                style = MaterialTheme.typography.titleMedium,
            )
            Spacer(Modifier.height(16.dp))
            Text("近 7 天", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(8.dp))
            WeekBarChart(days = state.week, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(24.dp))
        }
    }

    if (showConfig) {
        FocusConfigSheet(
            settings = state.settings,
            onDismiss = { showConfig = false },
            onSave = {
                viewModel.updateFocusSettings(it)
                showConfig = false
            },
        )
    }

    if (showTaskPicker) {
        TaskPickerSheet(
            tasks = tasks,
            selectedId = state.selectedTaskId,
            onDismiss = { showTaskPicker = false },
            onSelect = {
                viewModel.selectTask(it)
                showTaskPicker = false
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskPickerSheet(
    tasks: List<TaskEntity>,
    selectedId: String?,
    onDismiss: () -> Unit,
    onSelect: (String?) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
            Text(
                text = "关联任务（今天的未完成任务）",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 20.dp),
            )
            Spacer(Modifier.height(8.dp))
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(320.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(null) }
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                ) {
                    Text(
                        text = "不关联任务",
                        color = if (selectedId == null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                    )
                }
                tasks.forEach { task ->
                    HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(task.id) }
                            .padding(horizontal = 20.dp, vertical = 12.dp),
                    ) {
                        Text(
                            text = task.title,
                            color = if (selectedId == task.id) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
                if (tasks.isEmpty()) {
                    Text(
                        text = "今天没有未完成任务",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                    )
                }
            }
        }
    }
}