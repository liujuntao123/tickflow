package com.tickflow.app.feature.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.core.util.TimeUtils
import com.tickflow.app.ui.theme.DueNormal
import com.tickflow.app.ui.theme.PriorityHigh
import com.tickflow.app.ui.theme.PriorityLow
import com.tickflow.app.ui.theme.PriorityMedium

@Composable
fun TaskRow(
    task: TaskEntity,
    tagNames: List<String>,
    onToggle: () -> Unit,
    onClick: () -> Unit,
) {
    val completed = task.status == 2
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .clip(CircleShape)
                .border(
                    width = 2.dp,
                    color = if (completed) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                    shape = CircleShape,
                )
                .clickable(onClick = onToggle),
            contentAlignment = Alignment.Center,
        ) {
            if (completed) {
                Icon(
                    imageVector = Icons.Filled.Check,
                    contentDescription = "已完成",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
            }
        }

        Spacer(Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = task.title,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textDecoration = if (completed) TextDecoration.LineThrough else TextDecoration.None,
                color = if (completed) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            )
            val hasMeta = task.dueDate != null || tagNames.isNotEmpty()
            if (hasMeta) {
                Spacer(Modifier.size(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    task.dueDate?.let { DueChip(it) }
                    tagNames.take(3).forEach { TagChip(it) }
                }
            }
        }

        if (task.priority > 0) {
            Spacer(Modifier.width(8.dp))
            PriorityFlag(task.priority)
        }
    }
}

@Composable
fun DueChip(dueIso: String) {
    val color = when {
        TimeUtils.isOverdue(dueIso) -> PriorityHigh
        TimeUtils.isToday(dueIso) -> PriorityHigh
        else -> DueNormal
    }
    Text(
        text = TimeUtils.displayDue(dueIso).orEmpty(),
        style = MaterialTheme.typography.labelSmall,
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(color.copy(alpha = 0.14f))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
fun TagChip(name: String) {
    Text(
        text = "#$name",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
fun PriorityFlag(priority: Int) {
    val color = when (priority) {
        5 -> PriorityHigh
        3 -> PriorityMedium
        else -> PriorityLow
    }
    Icon(
        imageVector = Icons.Filled.Flag,
        contentDescription = "优先级",
        tint = color,
        modifier = Modifier.size(18.dp),
    )
}