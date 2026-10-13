package com.tickflow.app.core.reminder

import com.tickflow.app.core.util.TimeUtils
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

enum class Frequency { DAILY, WEEKLY, MONTHLY, YEARLY }

data class RecurrenceSpec(
    val frequency: Frequency,
    val interval: Int = 1,
    /** Calendar.SUNDAY..SATURDAY */
    val byDay: List<Int> = emptyList(),
    val byMonthDay: Int? = null,
    val byMonth: Int? = null,
    val count: Int? = null,
    val untilIso: String? = null,
)

/**
 * 白名单 RRULE 引擎（每天/每周几/每月某日/每年 + 间隔 + 结束条件）：
 * 仅负责**解析 / 构建 / 中文描述**。重复任务完成后的滚动由服务端权威计算，
 * 客户端不再自行展开 occurrence。
 * 规则字符串格式与 Web 端 `web/src/lib/rrule.ts` 共享白名单保持一致。
 */
object RecurrenceEngine {

    private val BASIC_UNTIL = SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    // ---------------- parse / build ----------------

    fun parse(rule: String?): RecurrenceSpec? {
        if (rule.isNullOrBlank()) return null
        val parts = rule.split(';').mapNotNull { segment ->
            val i = segment.indexOf('=')
            if (i <= 0) null else segment.substring(0, i).trim().uppercase(Locale.US) to segment.substring(i + 1).trim()
        }.toMap()

        val frequency = when (parts["FREQ"]) {
            "DAILY" -> Frequency.DAILY
            "WEEKLY" -> Frequency.WEEKLY
            "MONTHLY" -> Frequency.MONTHLY
            "YEARLY" -> Frequency.YEARLY
            else -> return null
        }
        val interval = parts["INTERVAL"]?.toIntOrNull()?.takeIf { it >= 1 } ?: 1
        val byDay = parts["BYDAY"]?.split(',')?.mapNotNull { dayOfWeek(it) }?.distinct()?.sorted() ?: emptyList()
        val byMonthDay = parts["BYMONTHDAY"]?.toIntOrNull()?.takeIf { it in 1..31 }
        val byMonth = parts["BYMONTH"]?.toIntOrNull()?.takeIf { it in 1..12 }
        val count = parts["COUNT"]?.toIntOrNull()?.takeIf { it >= 1 }
        val until = parts["UNTIL"]?.let { parseUntil(it) }

        return RecurrenceSpec(frequency, interval, byDay, byMonthDay, byMonth, count, until)
    }

    fun build(spec: RecurrenceSpec): String {
        val sb = StringBuilder("FREQ=${spec.frequency.name}")
        if (spec.interval > 1) sb.append(";INTERVAL=${spec.interval}")
        if (spec.frequency == Frequency.WEEKLY && spec.byDay.isNotEmpty()) {
            sb.append(";BYDAY=").append(spec.byDay.sorted().joinToString(",") { dayCode(it) })
        }
        if (spec.frequency == Frequency.MONTHLY && spec.byMonthDay != null) {
            sb.append(";BYMONTHDAY=${spec.byMonthDay}")
        }
        if (spec.frequency == Frequency.YEARLY && spec.byMonthDay != null) {
            // 与共享白名单保持一致：不输出 BYMONTH（月份跟随锚点 dtstart）
            sb.append(";BYMONTHDAY=${spec.byMonthDay}")
        }
        spec.count?.let { sb.append(";COUNT=$it") }
        spec.untilIso?.let { sb.append(";UNTIL=${toBasicUtc(it)}") }
        return sb.toString()
    }

    // ---------------- describe （中文摘要） ----------------

    fun describe(rule: String?, repeatFrom: Int): String? {
        val spec = parse(rule) ?: return null
        val frequency = when (spec.frequency) {
            Frequency.DAILY -> if (spec.interval == 1) "每天" else "每 ${spec.interval} 天"
            Frequency.WEEKLY -> {
                val prefix = if (spec.interval == 1) "每周" else "每 ${spec.interval} 周"
                if (spec.byDay.isEmpty()) prefix else prefix + spec.byDay.sorted().joinToString("、") { dayName(it) }
            }
            Frequency.MONTHLY -> {
                val prefix = if (spec.interval == 1) "每月" else "每 ${spec.interval} 月"
                if (spec.byMonthDay != null) "$prefix ${spec.byMonthDay} 日" else prefix
            }
            Frequency.YEARLY -> {
                val prefix = if (spec.interval == 1) "每年" else "每 ${spec.interval} 年"
                val day = spec.byMonthDay
                if (day != null) "$prefix $day 日" else prefix
            }
        }
        val end = when {
            spec.count != null -> "，共 ${spec.count} 次"
            spec.untilIso != null -> "，至 ${spec.untilIso.take(10)}"
            else -> ""
        }
        val base = if (repeatFrom == 1) "（按完成日）" else "（按截止日）"
        return frequency + end + base
    }

    // ---------------- helpers ----------------

    private fun dayOfWeek(code: String): Int? = when (code.trim().uppercase(Locale.US)) {
        "MO" -> Calendar.MONDAY
        "TU" -> Calendar.TUESDAY
        "WE" -> Calendar.WEDNESDAY
        "TH" -> Calendar.THURSDAY
        "FR" -> Calendar.FRIDAY
        "SA" -> Calendar.SATURDAY
        "SU" -> Calendar.SUNDAY
        else -> null
    }

    private fun dayCode(dow: Int): String = when (dow) {
        Calendar.MONDAY -> "MO"
        Calendar.TUESDAY -> "TU"
        Calendar.WEDNESDAY -> "WE"
        Calendar.THURSDAY -> "TH"
        Calendar.FRIDAY -> "FR"
        Calendar.SATURDAY -> "SA"
        else -> "SU"
    }

    fun dayName(dow: Int): String = when (dow) {
        Calendar.MONDAY -> "周一"
        Calendar.TUESDAY -> "周二"
        Calendar.WEDNESDAY -> "周三"
        Calendar.THURSDAY -> "周四"
        Calendar.FRIDAY -> "周五"
        Calendar.SATURDAY -> "周六"
        else -> "周日"
    }

    private fun toBasicUtc(iso: String): String {
        val date = TimeUtils.parseIso(iso) ?: return iso
        return BASIC_UNTIL.format(date)
    }

    private fun parseUntil(value: String): String? {
        val trimmed = value.trim()
        if (Regex("^\\d{8}T\\d{6}Z$").matches(trimmed)) {
            val date = runCatching { BASIC_UNTIL.parse(trimmed) }.getOrNull() ?: return null
            return TimeUtils.formatIso(date)
        }
        return TimeUtils.parseIso(trimmed)?.let { TimeUtils.formatIso(it) }
    }
}