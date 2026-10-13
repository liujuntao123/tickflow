package com.tickflow.app.feature.tasks

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.core.reminder.Frequency
import com.tickflow.app.core.reminder.RecurrenceEngine
import com.tickflow.app.core.reminder.RecurrenceSpec
import com.tickflow.app.core.util.TimeUtils
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private val WEEK_DAYS = listOf(
    Calendar.MONDAY to "一",
    Calendar.TUESDAY to "二",
    Calendar.WEDNESDAY to "三",
    Calendar.THURSDAY to "四",
    Calendar.FRIDAY to "五",
    Calendar.SATURDAY to "六",
    Calendar.SUNDAY to "日",
)

/**
 * 重复规则编辑（白名单 RRULE）。非法输入不允许保存。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecurrenceSheet(
    task: TaskEntity?,
    onDismiss: () -> Unit,
    onSave: (rule: String?, recurrenceEnd: String?, dtstart: String?, repeatFrom: Int) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val existing = remember(task?.id, task?.recurrenceRule) { RecurrenceEngine.parse(task?.recurrenceRule) }

    var frequency by remember { mutableStateOf(existing?.frequency ?: Frequency.WEEKLY) }
    var intervalText by remember { mutableStateOf((existing?.interval ?: 1).toString()) }
    var days by remember { mutableStateOf(existing?.byDay?.toSet() ?: emptySet()) }
    var monthDayText by remember { mutableStateOf(existing?.byMonthDay?.toString() ?: "") }
    var endMode by remember {
        mutableStateOf(
            when {
                existing?.count != null -> "count"
                existing?.untilIso != null -> "date"
                else -> "never"
            }
        )
    }
    var endDateText by remember { mutableStateOf(defaultEndDate(task)) }
    var endCountText by remember { mutableStateOf(existing?.count?.toString() ?: "10") }
    var repeatFrom by remember { mutableStateOf(task?.repeatFrom ?: 0) }
    var error by remember { mutableStateOf<String?>(null) }

    fun buildSpecOrNull(): RecurrenceSpec? {
        val interval = intervalText.toIntOrNull()?.takeIf { it in 1..365 }
            ?: run { error = "间隔需为 1-365 的整数"; return null }
        val spec = when (frequency) {
            Frequency.DAILY -> RecurrenceSpec(Frequency.DAILY, interval)
            Frequency.WEEKLY -> {
                if (days.isEmpty()) { error = "每周重复需至少选择一天"; return null }
                RecurrenceSpec(Frequency.WEEKLY, interval, byDay = days.toList())
            }
            Frequency.MONTHLY -> {
                val day = monthDayText.toIntOrNull()?.takeIf { it in 1..31 }
                    ?: run { error = "每月重复需填写 1-31 的日期"; return null }
                RecurrenceSpec(Frequency.MONTHLY, interval, byMonthDay = day)
            }
            Frequency.YEARLY -> {
                val day = monthDayText.toIntOrNull()?.takeIf { it in 1..31 }
                    ?: run { error = "请填写 1-31 的日期"; return null }
                RecurrenceSpec(Frequency.YEARLY, interval, byMonthDay = day)
            }
        }
        return when (endMode) {
            "date" -> {
                val until = parseLocalDateEndIso(endDateText)
                    ?: run { error = "结束日期格式应为 yyyy-MM-dd"; return null }
                val dueMs = task?.dueDate?.let { TimeUtils.parseIso(it)?.time }
                val untilMs = TimeUtils.parseIso(until)?.time
                if (dueMs != null && untilMs != null && untilMs <= dueMs) {
                    error = "结束日期需晚于截止时间"; return null
                }
                spec.copy(untilIso = until)
            }
            "count" -> {
                val count = endCountText.toIntOrNull()?.takeIf { it in 1..999 }
                    ?: run { error = "次数需为 1-999 的整数"; return null }
                spec.copy(count = count)
            }
            else -> spec
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
        ) {
            Text("重复", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))

            RecurrenceLabel("频率")
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf(
                    Frequency.DAILY to "每天",
                    Frequency.WEEKLY to "每周",
                    Frequency.MONTHLY to "每月",
                    Frequency.YEARLY to "每年",
                ).forEach { (value, label) ->
                    FilterChip(
                        selected = frequency == value,
                        onClick = { frequency = value; error = null },
                        label = { Text(label) },
                    )
                }
            }

            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                OutlinedTextField(
                    value = intervalText,
                    onValueChange = { intervalText = it.filter { c -> c.isDigit() }; error = null },
                    label = { Text("间隔") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.width(140.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(when (frequency) {
                    Frequency.DAILY -> "天"
                    Frequency.WEEKLY -> "周"
                    Frequency.MONTHLY -> "月"
                    Frequency.YEARLY -> "年"
                }, style = MaterialTheme.typography.bodyMedium)
            }

            if (frequency == Frequency.WEEKLY) {
                RecurrenceLabel("每周几")
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    WEEK_DAYS.forEach { (value, label) ->
                        FilterChip(
                            selected = days.contains(value),
                            onClick = {
                                days = if (days.contains(value)) days - value else days + value
                                error = null
                            },
                            label = { Text(label) },
                        )
                    }
                }
            }

            if (frequency == Frequency.MONTHLY) {
                RecurrenceLabel("每月某日")
                OutlinedTextField(
                    value = monthDayText,
                    onValueChange = { monthDayText = it.filter { c -> c.isDigit() }; error = null },
                    label = { Text("1 - 31") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.width(160.dp),
                )
            }

            if (frequency == Frequency.YEARLY) {
                RecurrenceLabel("每年某日（月份跟随截止时间）")
                OutlinedTextField(
                    value = monthDayText,
                    onValueChange = { monthDayText = it.filter { c -> c.isDigit() }; error = null },
                    label = { Text("日 1-31") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.width(160.dp),
                )
            }

            RecurrenceLabel("结束")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("never" to "永不", "date" to "按日期", "count" to "按次数").forEach { (value, label) ->
                    FilterChip(
                        selected = endMode == value,
                        onClick = { endMode = value; error = null },
                        label = { Text(label) },
                    )
                }
            }
            when (endMode) {
                "date" -> OutlinedTextField(
                    value = endDateText,
                    onValueChange = { endDateText = it.trim(); error = null },
                    label = { Text("结束日期 (yyyy-MM-dd)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                "count" -> OutlinedTextField(
                    value = endCountText,
                    onValueChange = { endCountText = it.filter { c -> c.isDigit() }; error = null },
                    label = { Text("共重复次数") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.width(180.dp),
                )
            }

            RecurrenceLabel("重复基准")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = repeatFrom == 0,
                    onClick = { repeatFrom = 0 },
                    label = { Text("按截止日") },
                )
                FilterChip(
                    selected = repeatFrom == 1,
                    onClick = { repeatFrom = 1 },
                    label = { Text("按完成日") },
                )
            }

            error?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = { onSave(null, null, null, 0) },
                    modifier = Modifier.weight(1f),
                ) { Text("清除重复") }
                Button(
                    onClick = {
                        error = null
                        val spec = buildSpecOrNull() ?: return@Button
                        val rule = RecurrenceEngine.build(spec)
                        onSave(rule, spec.untilIso, task?.dueDate, repeatFrom)
                    },
                    modifier = Modifier.weight(1f),
                ) { Text("保存") }
            }
        }
    }
}

@Composable
private fun RecurrenceLabel(text: String) {
    Spacer(Modifier.height(14.dp))
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Spacer(Modifier.height(6.dp))
}

/** 默认结束日期：今天 + 30 天，格式 yyyy-MM-dd。 */
private fun defaultEndDate(task: TaskEntity?): String {
    val format = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val cal = Calendar.getInstance()
    if (task?.dueDate != null) {
        TimeUtils.parseIso(task.dueDate)?.let { cal.time = it }
    }
    cal.add(Calendar.DAY_OF_YEAR, 30)
    return format.format(cal.time)
}

/** yyyy-MM-dd（本地时区）→ 当日 23:59:59 的 UTC ISO。 */
private fun parseLocalDateEndIso(text: String): String? {
    val format = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    format.isLenient = false
    val date = runCatching { format.parse(text) }.getOrNull() ?: return null
    val cal = Calendar.getInstance().apply {
        time = date
        set(Calendar.HOUR_OF_DAY, 23)
        set(Calendar.MINUTE, 59)
        set(Calendar.SECOND, 59)
        set(Calendar.MILLISECOND, 0)
    }
    return TimeUtils.formatIso(cal.time)
}