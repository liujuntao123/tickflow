package com.tickflow.app.feature.tasks

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    viewModel: TasksViewModel,
    onOpenDrawer: () -> Unit,
    onOpenTask: (String) -> Unit,
    onSync: () -> Unit,
    onOpenMatrix: (() -> Unit)? = null,
) {
    val tasks by viewModel.tasks.collectAsStateWithLifecycle()
    val title by viewModel.title.collectAsStateWithLifecycle()
    val smart by viewModel.smart.collectAsStateWithLifecycle()
    val tags by viewModel.tags.collectAsStateWithLifecycle()
    val lists by viewModel.lists.collectAsStateWithLifecycle()
    val selectedListId by viewModel.selectedListId.collectAsStateWithLifecycle()
    val isSyncing by viewModel.isSyncing.collectAsStateWithLifecycle()
    val syncMessage by viewModel.syncMessage.collectAsStateWithLifecycle()
    val subtaskCounts by viewModel.subtaskCounts.collectAsStateWithLifecycle()

    val tagMap = remember(tags) { tags.associate { it.id to it.name } }
    var showQuickAdd by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(syncMessage) {
        syncMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSyncMessage()
        }
    }

    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = { Text(title) },
                    navigationIcon = {
                        IconButton(onClick = onOpenDrawer) { Icon(Icons.Filled.Menu, contentDescription = "菜单") }
                    },
                    actions = {
                        if (onOpenMatrix != null) {
                            IconButton(onClick = onOpenMatrix) {
                                Icon(Icons.Filled.GridView, contentDescription = "四象限")
                            }
                        }
                        IconButton(onClick = onSync) { Icon(Icons.Filled.Sync, contentDescription = "同步") }
                    },
                )
                if (isSyncing) {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth().height(2.dp))
                }
            }
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showQuickAdd = true }) {
                Icon(Icons.Filled.Add, contentDescription = "快速添加")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                viewModel.smartLists.forEach { item ->
                    FilterChip(
                        selected = smart == item.key && selectedListId == null,
                        onClick = { viewModel.selectSmartList(item.key) },
                        label = { Text(item.label) },
                    )
                }
            }

            PullToRefreshBox(
                isRefreshing = isSyncing,
                onRefresh = onSync,
                modifier = Modifier.weight(1f),
            ) {
                if (tasks.isEmpty()) {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(
                            text = "暂无任务",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = "点击右下角 + 快速添加",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(items = tasks, key = { it.id }) { task ->
                            TaskRow(
                                task = task,
                                tagNames = task.tagIds.mapNotNull { tagMap[it] },
                                repeatRule = task.recurrenceRule,
                                subtaskCount = subtaskCounts[task.id] ?: 0,
                                onToggle = { viewModel.toggleComplete(task) },
                                onClick = { onOpenTask(task.id) },
                            )
                            HorizontalDivider(
                                modifier = Modifier.padding(start = 52.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                            )
                        }
                    }
                }
            }
        }
    }

    if (showQuickAdd) {
        QuickAddSheet(
            lists = lists.map { it.id to it.name },
            defaultListId = selectedListId,
            onDismiss = { showQuickAdd = false },
            onConfirm = { titleText, listId, dueDate, priority, isAllDay ->
                viewModel.quickAdd(titleText, listId, dueDate, priority, isAllDay)
                showQuickAdd = false
            },
        )
    }
}