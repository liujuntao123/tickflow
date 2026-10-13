package com.tickflow.app.feature.main

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Label
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tickflow.app.feature.tasks.TasksViewModel

@Composable
fun AppDrawer(
    viewModel: TasksViewModel,
    onClose: () -> Unit,
    onNavigateTasks: () -> Unit,
) {
    val lists by viewModel.lists.collectAsStateWithLifecycle()
    val folders by viewModel.folders.collectAsStateWithLifecycle()
    val tags by viewModel.tags.collectAsStateWithLifecycle()
    val selectedListId by viewModel.selectedListId.collectAsStateWithLifecycle()

    var showNewListDialog by remember { mutableStateOf(false) }

    ModalDrawerSheet {
        Column(
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(vertical = 16.dp),
        ) {
            Text(
                text = "TickFlow",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
            )

            SectionLabel("全部清单")
            lists.forEach { list ->
                NavigationDrawerItem(
                    label = { Text(list.name) },
                    selected = selectedListId == list.id,
                    onClick = {
                        viewModel.selectList(list.id, list.name)
                        onNavigateTasks()
                        onClose()
                    },
                    icon = {
                        Icon(
                            if (list.isInbox) Icons.Filled.Inbox else Icons.AutoMirrored.Filled.List,
                            contentDescription = null,
                        )
                    },
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
            }

            if (folders.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                SectionLabel("文件夹")
                folders.forEach { folder ->
                    NavigationDrawerItem(
                        label = { Text(folder.name) },
                        selected = false,
                        onClick = { onClose() },
                        icon = { Icon(Icons.Filled.Folder, contentDescription = null) },
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                }
            }

            if (tags.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                SectionLabel("标签")
                tags.forEach { tag ->
                    NavigationDrawerItem(
                        label = { Text("# ${tag.name}") },
                        selected = false,
                        onClick = { onClose() },
                        icon = { Icon(Icons.Filled.Label, contentDescription = null) },
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                }
            }

            Spacer(Modifier.height(8.dp))
            HorizontalDivider()
            Spacer(Modifier.height(8.dp))
            NavigationDrawerItem(
                label = { Text("新建清单") },
                selected = false,
                onClick = { showNewListDialog = true },
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                modifier = Modifier.padding(horizontal = 12.dp),
            )
        }
    }

    if (showNewListDialog) {
        NewListDialog(
            onDismiss = { showNewListDialog = false },
            onConfirm = { name ->
                viewModel.createList(name)
                showNewListDialog = false
            },
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 28.dp, vertical = 6.dp),
    )
}

@Composable
private fun NewListDialog(onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("新建清单") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("清单名称") },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(
                onClick = { if (name.isNotBlank()) onConfirm(name) },
                enabled = name.isNotBlank(),
            ) { Text("创建") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } },
    )
}