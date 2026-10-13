package com.tickflow.app.feature.tasks

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tickflow.app.core.util.TimeUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickAddSheet(
    lists: List<Pair<String, String>>,
    defaultListId: String?,
    onDismiss: () -> Unit,
    onConfirm: (title: String, listId: String?, dueDate: String?, priority: Int, isAllDay: Boolean) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var title by remember { mutableStateOf("") }
    var listId by remember { mutableStateOf(defaultListId ?: lists.firstOrNull()?.first) }
    var dueLabel by remember { mutableStateOf("无") }
    var dueDate by remember { mutableStateOf<String?>(null) }
    var isAllDay by remember { mutableStateOf(false) }
    var priority by remember { mutableStateOf(0) }

    val dateOptions: List<Pair<String, String?>> = listOf(
        "无" to null,
        "今天" to TimeUtils.startOfTodayIso(),
        "明天" to TimeUtils.plusDaysIso(TimeUtils.startOfTodayIso(), 1),
        "下周" to TimeUtils.plusDaysIso(TimeUtils.startOfTodayIso(), 7),
    )
    val priorityOptions = listOf(0 to "无", 1 to "低", 3 to "中", 5 to "高")

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
        ) {
            Text("快速添加任务", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("标题") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            SectionLabel("清单")
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                lists.forEach { (id, name) ->
                    FilterChip(
                        selected = listId == id,
                        onClick = { listId = id },
                        label = { Text(name) },
                    )
                }
            }

            SectionLabel("日期")
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                dateOptions.forEach { (label, value) ->
                    FilterChip(
                        selected = dueLabel == label,
                        onClick = {
                            dueLabel = label
                            dueDate = value
                            isAllDay = value != null
                        },
                        label = { Text(label) },
                    )
                }
            }

            SectionLabel("优先级")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                priorityOptions.forEach { (value, label) ->
                    FilterChip(
                        selected = priority == value,
                        onClick = { priority = value },
                        label = { Text(label) },
                    )
                }
            }

            Spacer(Modifier.height(20.dp))
            Button(
                onClick = { onConfirm(title.trim(), listId, dueDate, priority, isAllDay) },
                enabled = title.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("添加")
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Spacer(Modifier.height(14.dp))
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Spacer(Modifier.height(6.dp))
}