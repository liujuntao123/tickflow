package com.tickflow.app.feature.tasks

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tickflow.app.core.reminder.RecurrenceEngine
import com.tickflow.app.core.util.TimeUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailScreen(
    taskId: String,
    onBack: () -> Unit,
    viewModel: TaskDetailViewModel = hiltViewModel(),
) {
    val task by viewModel.task.collectAsStateWithLifecycle()
    val subtasks by viewModel.subtasks.collectAsStateWithLifecycle()
    val tags by viewModel.tags.collectAsStateWithLifecycle()

    var title by remember(task?.id) { mutableStateOf(task?.title.orEmpty()) }
    var notes by remember(task?.id) { mutableStateOf(task?.notes.orEmpty()) }
    var newSubtask by remember { mutableStateOf("") }
    var showRecurrence by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("任务详情") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.deleteTask(onBack) }) {
                        Icon(Icons.Filled.Delete, contentDescription = "删除")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = task?.status == 2, onCheckedChange = { viewModel.toggleComplete() })
                OutlinedTextField(
                    value = title,
                    onValueChange = {
                        title = it
                        viewModel.updateTitle(it)
                    },
                    label = { Text("标题") },
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = notes,
                onValueChange = {
                    notes = it
                    viewModel.updateNotes(it)
                },
                label = { Text("备注") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(16.dp))
            SectionTitle("优先级")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(0 to "无", 1 to "低", 3 to "中", 5 to "高").forEach { (value, label) ->
                    FilterChip(
                        selected = task?.priority == value,
                        onClick = { viewModel.setPriority(value) },
                        label = { Text(label) },
                    )
                }
            }

            Spacer(Modifier.height(16.dp))
            SectionTitle("截止时间")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                viewModel.dueOptions.forEach { (label, value, allDay) ->
                    FilterChip(
                        selected = task?.dueDate == value,
                        onClick = { viewModel.setDueDate(value, allDay) },
                        label = { Text(label) },
                    )
                }
            }
            task?.dueDate?.let {
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "当前：${TimeUtils.displayDue(it).orEmpty()}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "重复",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(end = 12.dp),
                )
                Text(
                    text = RecurrenceEngine.describe(task?.recurrenceRule, task?.repeatFrom ?: 0) ?: "不重复",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f),
                )
                TextButton(
                    onClick = { showRecurrence = true },
                    enabled = task?.dueDate != null,
                ) {
                    Text(if (task?.recurrenceRule.isNullOrBlank()) "设置" else "修改")
                }
            }
            if (task?.dueDate == null) {
                Text(
                    text = "需先设置截止时间才能开启重复",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(16.dp))
            SectionTitle("提醒")
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                viewModel.reminderOptions.forEach { (offset, label) ->
                    FilterChip(
                        selected = task?.reminders?.any { it.offset == offset } == true,
                        onClick = { viewModel.toggleReminder(offset) },
                        label = { Text(label) },
                    )
                }
            }
            if (task?.dueDate == null) {
                Text(
                    text = "提醒需在设置截止时间后生效",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (tags.isNotEmpty()) {
                Spacer(Modifier.height(16.dp))
                SectionTitle("标签")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    tags.forEach { tag ->
                        FilterChip(
                            selected = task?.tagIds?.contains(tag.id) == true,
                            onClick = { viewModel.toggleTag(tag.id) },
                            label = { Text(tag.name) },
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            HorizontalDivider()
            Spacer(Modifier.height(12.dp))
            SectionTitle("子任务")
            subtasks.forEach { sub ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = sub.status == 2, onCheckedChange = { viewModel.toggleSubtask(sub) })
                    Text(
                        text = sub.title,
                        style = MaterialTheme.typography.bodyLarge,
                        textDecoration = if (sub.status == 2) TextDecoration.LineThrough else TextDecoration.None,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { viewModel.deleteSubtask(sub) }) {
                        Icon(Icons.Filled.Delete, contentDescription = "删除子任务")
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = newSubtask,
                    onValueChange = { newSubtask = it },
                    label = { Text("添加子任务") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                IconButton(
                    onClick = {
                        viewModel.addSubtask(newSubtask)
                        newSubtask = ""
                    },
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "添加")
                }
            }

            Spacer(Modifier.height(24.dp))
            TextButton(onClick = { viewModel.deleteTask(onBack) }) {
                Text("删除任务", color = MaterialTheme.colorScheme.error)
            }
        }
    }

    if (showRecurrence) {
        RecurrenceSheet(
            task = task,
            onDismiss = { showRecurrence = false },
            onSave = { rule, recurrenceEnd, dtstart, repeatFrom ->
                viewModel.setRecurrence(rule, recurrenceEnd, dtstart, repeatFrom)
                showRecurrence = false
            },
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Spacer(Modifier.height(6.dp))
}