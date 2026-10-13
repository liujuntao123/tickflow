package com.tickflow.app.feature.matrix

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.feature.tasks.TaskRow
import kotlin.math.roundToInt

private data class DragState(val task: TaskEntity, val position: Offset)

private val QUADRANT_TITLES = listOf(
    "重要且紧急",
    "重要不紧急",
    "紧急不重要",
    "不重要不紧急",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatrixScreen(
    onOpenTask: (String) -> Unit,
    viewModel: MatrixViewModel = hiltViewModel(),
) {
    val quadrants by viewModel.quadrants.collectAsStateWithLifecycle()
    val tagMap by viewModel.tagMap.collectAsStateWithLifecycle()
    val counts by viewModel.subtaskCounts.collectAsStateWithLifecycle()

    val containerOrigin = remember { mutableStateOf(Offset.Zero) }
    val bounds = remember { mutableStateMapOf<Int, Rect>() }
    var drag by remember { mutableStateOf<DragState?>(null) }

    fun onDragEnd() {
        val current = drag
        if (current != null) {
            val targetIndex = bounds.entries.firstOrNull { it.value.contains(current.position) }?.key
            if (targetIndex != null) {
                // 索引 0/1 = 重要象限
                viewModel.setImportant(current.task, targetIndex == 0 || targetIndex == 1)
            }
        }
        drag = null
    }

    val lists = listOf(quadrants.q1, quadrants.q2, quadrants.q3, quadrants.q4)

    Scaffold(topBar = { TopAppBar(title = { Text("四象限") }) }) { padding ->
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .onGloballyPositioned { containerOrigin.value = it.positionInRoot() },
        ) {
            Column(modifier = Modifier.fillMaxSize().padding(8.dp)) {
                Text(
                    text = "共 ${lists.sumOf { it.size }} 个未完成任务",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = "拖拽任务到其他象限仅调整优先级：重要 → 高(5)，不重要 → 低(1)；紧急由到期时间（≤ 明天）自动判定。",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))

                for (rowIndex in 0 until 2) {
                    Row(modifier = Modifier.fillMaxWidth().weight(1f)) {
                        for (colIndex in 0 until 2) {
                            val index = rowIndex * 2 + colIndex
                            QuadrantBox(
                                index = index,
                                title = QUADRANT_TITLES[index],
                                tasks = lists[index],
                                tagMap = tagMap,
                                subtaskCounts = counts,
                                highlighted = drag != null && bounds[index]?.contains(drag!!.position) == true,
                                onBounds = { i, rect -> bounds[i] = rect },
                                onOpenTask = onOpenTask,
                                onToggle = viewModel::toggleComplete,
                                onDragStart = { task, position -> drag = DragState(task, position) },
                                onDragMove = { amount -> drag = drag?.let { it.copy(position = it.position + amount) } },
                                onDragEnd = { onDragEnd() },
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxSize()
                                    .padding(4.dp),
                            )
                        }
                    }
                    if (rowIndex == 0) Spacer(Modifier.height(8.dp))
                }
            }

            drag?.let { current ->
                val origin = containerOrigin.value
                Surface(
                    modifier = Modifier
                        .offset {
                            IntOffset(
                                (current.position.x - origin.x).roundToInt() - 40,
                                (current.position.y - origin.y).roundToInt() - 20,
                            )
                        }
                        .width(200.dp),
                    shape = RoundedCornerShape(8.dp),
                    shadowElevation = 8.dp,
                    color = MaterialTheme.colorScheme.surfaceVariant,
                ) {
                    Text(
                        text = current.task.title,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(10.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun QuadrantBox(
    index: Int,
    title: String,
    tasks: List<TaskEntity>,
    tagMap: Map<String, String>,
    subtaskCounts: Map<String, Int>,
    highlighted: Boolean,
    onBounds: (Int, Rect) -> Unit,
    onOpenTask: (String) -> Unit,
    onToggle: (TaskEntity) -> Unit,
    onDragStart: (TaskEntity, Offset) -> Unit,
    onDragMove: (Offset) -> Unit,
    onDragEnd: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val borderColor = if (highlighted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surface)
            .onGloballyPositioned { onBounds(index, it.boundsInRoot()) },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(borderColor.copy(alpha = if (highlighted) 0.25f else 0.6f))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(title, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
            Text("${tasks.size}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (tasks.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = "拖拽任务到此处",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(tasks, key = { it.id }) { task ->
                    var itemOrigin by remember(task.id) { mutableStateOf(Offset.Zero) }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .onGloballyPositioned { itemOrigin = it.positionInRoot() }
                            .pointerInput(task.id) {
                                detectDragGesturesAfterLongPress(
                                    onDragStart = { offset -> onDragStart(task, itemOrigin + offset) },
                                    onDrag = { change, amount ->
                                        change.consume()
                                        onDragMove(amount)
                                    },
                                    onDragEnd = { onDragEnd() },
                                    onDragCancel = { onDragEnd() },
                                )
                            },
                    ) {
                        TaskRow(
                            task = task,
                            tagNames = task.tagIds.mapNotNull { tagMap[it] },
                            repeatRule = task.recurrenceRule,
                            subtaskCount = subtaskCounts[task.id] ?: 0,
                            onToggle = { onToggle(task) },
                            onClick = { onOpenTask(task.id) },
                        )
                    }
                }
            }
        }
    }
}