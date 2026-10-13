package com.tickflow.app.feature.habits

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitsScreen(viewModel: HabitsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    var showTemplates by remember { mutableStateOf(false) }
    var showAddOptions by remember { mutableStateOf(false) }
    var editorTarget by remember { mutableStateOf<HabitCard?>(null) }
    var showEditor by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<HabitCard?>(null) }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            viewModel.consumeMessage()
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("习惯") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddOptions = true }) {
                Icon(Icons.Filled.Add, contentDescription = "新建习惯")
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when {
                state.loading && state.habits.isEmpty() -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                state.habits.isEmpty() -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("还没有习惯", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "点击右下角 + 从模板或自定义创建",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(state.habits, key = { it.id }) { card ->
                            HabitCardItem(
                                card = card,
                                onToggle = { viewModel.toggleToday(card) },
                                onClick = {
                                    editorTarget = card
                                    showEditor = true
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    if (showAddOptions) {
        AlertDialog(
            onDismissRequest = { showAddOptions = false },
            title = { Text("新建习惯") },
            text = { Text("从模板库快速创建，或自定义一个习惯。") },
            confirmButton = {
                TextButton(onClick = {
                    showAddOptions = false
                    showTemplates = true
                }) { Text("模板库") }
            },
            dismissButton = {
                TextButton(onClick = {
                    showAddOptions = false
                    editorTarget = null
                    showEditor = true
                }) { Text("自定义") }
            },
        )
    }

    if (showTemplates) {
        HabitTemplateSheet(
            templates = state.templates,
            onDismiss = { showTemplates = false },
            onPick = { template ->
                viewModel.createFromTemplate(template.id)
                showTemplates = false
            },
        )
    }

    if (showEditor) {
        HabitEditorSheet(
            existing = editorTarget,
            onDismiss = { showEditor = false },
            onSave = { request ->
                val target = editorTarget
                if (target == null) viewModel.createCustom(request) else viewModel.updateHabit(target.id, request)
                showEditor = false
            },
            onArchive = editorTarget?.let { target ->
                { archived: Boolean ->
                    viewModel.setArchived(target, archived)
                    showEditor = false
                }
            },
            onDelete = editorTarget?.let { target ->
                {
                    pendingDelete = target
                    showEditor = false
                }
            },
        )
    }

    pendingDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("删除习惯") },
            text = { Text("确定删除「${target.name}」吗？此操作不可撤销。") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.delete(target)
                    pendingDelete = null
                }) { Text("删除", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("取消") } },
        )
    }
}