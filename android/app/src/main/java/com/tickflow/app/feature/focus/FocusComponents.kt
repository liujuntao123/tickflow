package com.tickflow.app.feature.focus

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.tickflow.app.core.network.dto.FocusByDayDto
import com.tickflow.app.core.network.dto.FocusSettingsPayload
import com.tickflow.app.core.util.TimeUtils

/** 自绘圆环倒计时。 */
@Composable
fun TimerRing(
    remainingFraction: Float,
    active: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val primary = MaterialTheme.colorScheme.primary
    val track = MaterialTheme.colorScheme.surfaceVariant
    val fraction = remainingFraction.coerceIn(0f, 1f)

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val stroke = 16.dp.toPx()
            val inset = stroke / 2f
            val arcSize = Size(size.width - stroke, size.height - stroke)
            drawArc(
                color = track,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
            drawArc(
                color = if (active) primary else track,
                startAngle = -90f,
                sweepAngle = 360f * fraction,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
        }
        content()
    }
}

/** 近 7 天专注时长柱状图（自绘）。 */
@Composable
fun WeekBarChart(days: List<FocusByDayDto>, modifier: Modifier = Modifier) {
    val max = (days.maxOfOrNull { it.totalSeconds } ?: 0).coerceAtLeast(1)
    val barColor = MaterialTheme.colorScheme.primary
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        days.forEach { day ->
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(80.dp),
                    contentAlignment = Alignment.BottomCenter,
                ) {
                    val fraction = (day.totalSeconds.toFloat() / max).coerceIn(
                        if (day.totalSeconds > 0) 0.06f else 0f,
                        1f,
                    )
                    if (fraction > 0f) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(0.55f)
                                .fillMaxHeight(fraction)
                                .background(barColor, RoundedCornerShape(4.dp)),
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    text = TimeUtils.shortDate(day.date).replace("-", "/"),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** 番茄配置面板（读写 settings.focusSettings）。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FocusConfigSheet(
    settings: FocusSettingsPayload,
    onDismiss: () -> Unit,
    onSave: (FocusSettingsPayload) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var focus by remember { mutableStateOf(settings.focusMinutes.toString()) }
    var shortBreak by remember { mutableStateOf(settings.shortBreakMinutes.toString()) }
    var longBreak by remember { mutableStateOf(settings.longBreakMinutes.toString()) }
    var every by remember { mutableStateOf(settings.longBreakEvery.toString()) }
    var autoStart by remember { mutableStateOf(settings.autoStartNext) }
    var error by remember { mutableStateOf<String?>(null) }

    fun buildOrNull(): FocusSettingsPayload? {
        val f = focus.toIntOrNull()?.takeIf { it in 1..180 } ?: run { error = "专注时长需为 1-180 分钟"; return null }
        val s = shortBreak.toIntOrNull()?.takeIf { it in 1..60 } ?: run { error = "短休息需为 1-60 分钟"; return null }
        val l = longBreak.toIntOrNull()?.takeIf { it in 1..120 } ?: run { error = "长休息需为 1-120 分钟"; return null }
        val e = every.toIntOrNull()?.takeIf { it in 1..12 } ?: run { error = "长休息间隔需为 1-12"; return null }
        return FocusSettingsPayload(f, s, l, e, autoStart)
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
        ) {
            Text("番茄配置", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))

            Text("专注时长（分钟）", style = MaterialTheme.typography.labelMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("25", "45", "60").forEach { preset ->
                    FilterChip(
                        selected = focus == preset,
                        onClick = { focus = preset; error = null },
                        label = { Text("$preset 分钟") },
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = focus,
                onValueChange = { focus = it.filter { c -> c.isDigit() }; error = null },
                label = { Text("专注时长") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.width(160.dp),
            )

            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = shortBreak,
                    onValueChange = { shortBreak = it.filter { c -> c.isDigit() }; error = null },
                    label = { Text("短休息") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.width(140.dp),
                )
                OutlinedTextField(
                    value = longBreak,
                    onValueChange = { longBreak = it.filter { c -> c.isDigit() }; error = null },
                    label = { Text("长休息") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.width(140.dp),
                )
            }

            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = every,
                onValueChange = { every = it.filter { c -> c.isDigit() }; error = null },
                label = { Text("每 N 个番茄后长休息") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.width(220.dp),
            )

            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("结束后自动开始下一段", modifier = Modifier.weight(1f))
                Switch(checked = autoStart, onCheckedChange = { autoStart = it })
            }

            error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(20.dp))
            Button(
                onClick = { buildOrNull()?.let(onSave) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("保存配置") }
        }
    }
}