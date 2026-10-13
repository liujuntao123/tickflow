package com.tickflow.app.feature.habits

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.tickflow.app.core.network.dto.HabitTemplateDto
import com.tickflow.app.core.network.dto.HabitUpsertRequest

private const val HEATMAP_WEEKS = 12

private val HABIT_COLORS = listOf(
    0xFFE5484D.toInt(),
    0xFFF5A524.toInt(),
    0xFF3B6FE0.toInt(),
    0xFF30A46C.toInt(),
    0xFF8E4EC6.toInt(),
    0xFF6C7480.toInt(),
)

private val HABIT_EMOJIS = listOf("📚", "🏃", "💧", "🧘", "✍️", "🌙", "🥗", "💪", "🎯", "🎸", "🧹", "☀️")

private fun Int.argbColor(): Color = Color(0xFF000000.toInt() or (this and 0xFFFFFF))

private fun Color.toHabitColor(): Int = toArgb() and 0xFFFFFF

@Composable
fun HabitHeatmap(heat: List<Int>, target: Int, color: Int?, modifier: Modifier = Modifier) {
    val base = color?.argbColor() ?: MaterialTheme.colorScheme.primary
    val empty = MaterialTheme.colorScheme.surfaceVariant
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        for (row in 0 until 7) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                for (col in 0 until HEATMAP_WEEKS) {
                    val value = heat.getOrElse(col * 7 + row) { -1 }
                    val cellColor = when {
                        value < 0 -> empty.copy(alpha = 0.25f)
                        value == 0 -> empty
                        target <= 1 -> base
                        value >= target -> base
                        value * 2 >= target -> base.copy(alpha = 0.55f)
                        else -> base.copy(alpha = 0.3f)
                    }
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(cellColor),
                    )
                }
            }
        }
    }
}

@Composable
fun HabitCardItem(
    card: HabitCard,
    onToggle: () -> Unit,
    onClick: () -> Unit,
) {
    val accent = card.color?.argbColor() ?: MaterialTheme.colorScheme.primary
    val done = if (card.goalType == 1) card.todayValue > 0 else card.todayValue >= card.targetValue

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(accent.copy(alpha = 0.16f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(card.icon ?: "✅", style = MaterialTheme.typography.titleMedium)
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f).clickable(onClick = onClick)) {
                    Text(card.name, style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = buildString {
                            append("连续 ${card.currentStreak} 天 · 最长 ${card.longestStreak} 天")
                            if (card.archived) append(" · 已归档")
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(if (done) accent else MaterialTheme.colorScheme.surfaceVariant)
                        .clickable(onClick = onToggle),
                    contentAlignment = Alignment.Center,
                ) {
                    when {
                        card.goalType == 1 && done -> Icon(
                            imageVector = Icons.Filled.Check,
                            contentDescription = "已打卡",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                        card.goalType == 1 -> Icon(
                            imageVector = Icons.Filled.Check,
                            contentDescription = "未打卡",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp),
                        )
                        else -> Text(
                            text = "${card.todayValue}/${card.targetValue}",
                            style = MaterialTheme.typography.labelLarge,
                            color = if (done) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                HabitHeatmap(
                    heat = card.heat,
                    target = card.targetValue,
                    color = card.color,
                    modifier = Modifier.weight(1f),
                )
            }
            if (!card.unit.isNullOrBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "目标 ${card.targetValue} ${card.unit}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** 新建/编辑习惯面板。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitEditorSheet(
    existing: HabitCard?,
    onDismiss: () -> Unit,
    onSave: (HabitUpsertRequest) -> Unit,
    onArchive: ((Boolean) -> Unit)?,
    onDelete: (() -> Unit)?,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by remember { mutableStateOf(existing?.name.orEmpty()) }
    var icon by remember { mutableStateOf(existing?.icon ?: "📚") }
    var color by remember { mutableStateOf(existing?.color ?: HABIT_COLORS.first()) }
    var goalType by remember { mutableStateOf(existing?.goalType ?: 0) }
    var target by remember { mutableStateOf((existing?.targetValue ?: 1).toString()) }
    var unit by remember { mutableStateOf(existing?.unit.orEmpty()) }
    var frequency by remember { mutableStateOf(existing?.frequency ?: 0) }
    var weekDays by remember { mutableStateOf(existing?.weekDays?.toSet() ?: emptySet()) }
    var error by remember { mutableStateOf<String?>(null) }

    fun buildOrNull(): HabitUpsertRequest? {
        if (name.isBlank()) { error = "请填写习惯名称"; return null }
        val targetValue = if (goalType == 1) 1 else (target.toIntOrNull()?.takeIf { it >= 1 }
            ?: run { error = "目标值需为 ≥1 的整数"; return null })
        if (frequency == 1 && weekDays.isEmpty()) { error = "每周频率需至少选择一天"; return null }
        return HabitUpsertRequest(
            name = name.trim(),
            icon = icon.trim().ifBlank { null },
            color = color,
            goalType = goalType,
            targetValue = targetValue,
            unit = if (goalType == 1) null else unit.trim().ifBlank { null },
            frequency = frequency,
            weekDays = if (frequency == 1) weekDays.toList().sorted() else emptyList(),
        )
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .height(560.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
        ) {
            Text(
                text = if (existing == null) "新建习惯" else "编辑习惯",
                style = MaterialTheme.typography.titleMedium,
            )
            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = name,
                onValueChange = { name = it; error = null },
                label = { Text("名称") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Label("图标")
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                HABIT_EMOJIS.take(6).forEach { emoji ->
                    val selected = icon == emoji
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.16f) else MaterialTheme.colorScheme.surfaceVariant)
                            .clickable { icon = emoji }
                            .padding(6.dp),
                        contentAlignment = Alignment.Center,
                    ) { Text(emoji) }
                }
            }

            Label("颜色")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HABIT_COLORS.forEach { c ->
                    val selected = color == c
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(c.argbColor())
                            .border(
                                width = if (selected) 3.dp else 0.dp,
                                color = if (selected) MaterialTheme.colorScheme.onSurface else Color.Transparent,
                                shape = CircleShape,
                            )
                            .clickable { color = c },
                    )
                }
            }

            Label("目标类型")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = goalType == 1, onClick = { goalType = 1; error = null }, label = { Text("纯打卡") })
                FilterChip(selected = goalType == 0, onClick = { goalType = 0; error = null }, label = { Text("计数目标") })
            }

            if (goalType == 0) {
                Label("目标值")
                Row {
                    OutlinedTextField(
                        value = target,
                        onValueChange = { target = it.filter { c -> c.isDigit() }; error = null },
                        label = { Text("目标") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.width(130.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    OutlinedTextField(
                        value = unit,
                        onValueChange = { unit = it },
                        label = { Text("单位（如 分钟）") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Label("频率")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = frequency == 0, onClick = { frequency = 0 }, label = { Text("每天") })
                FilterChip(selected = frequency == 1, onClick = { frequency = 1 }, label = { Text("每周指定") })
            }
            if (frequency == 1) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("一", "二", "三", "四", "五", "六", "日").forEachIndexed { index, label ->
                        FilterChip(
                            selected = weekDays.contains(index),
                            onClick = {
                                weekDays = if (weekDays.contains(index)) weekDays - index else weekDays + index
                                error = null
                            },
                            label = { Text(label) },
                        )
                    }
                }
            }

            error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(20.dp))
            Button(
                onClick = { buildOrNull()?.let(onSave) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (existing == null) "创建" else "保存") }

            if (existing != null) {
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = { onArchive?.invoke(!existing.archived) },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(if (existing.archived) "取消归档" else "归档") }
                Spacer(Modifier.height(8.dp))
                TextButton(
                    onClick = { onDelete?.invoke() },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("删除习惯", color = MaterialTheme.colorScheme.error) }
            }
        }
    }
}

/** 习惯模板库网格。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitTemplateSheet(
    templates: List<HabitTemplateDto>,
    onDismiss: () -> Unit,
    onPick: (HabitTemplateDto) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
            Text(
                text = "习惯模板库",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 20.dp),
            )
            Spacer(Modifier.height(12.dp))
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxWidth().height(420.dp).padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(templates, key = { it.id }) { template ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { onPick(template) },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(template.icon, style = MaterialTheme.typography.titleLarge)
                            Spacer(Modifier.height(4.dp))
                            Text(template.title, style = MaterialTheme.typography.bodyMedium, maxLines = 2)
                            val detail = buildString {
                                if (template.defaultGoalType == 1) {
                                    append("每天打卡")
                                } else {
                                    append("${template.defaultTargetValue}")
                                    template.defaultUnit?.let { append(" $it") }
                                }
                            }
                            Text(
                                text = detail,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Label(text: String) {
    Spacer(Modifier.height(14.dp))
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Spacer(Modifier.height(6.dp))
}