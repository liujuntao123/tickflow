package com.tickflow.app.core.util

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * 时间工具。minSdk 24 不使用 java.time（API 26+），统一用 SimpleDateFormat(UTC)。
 * 固定毫秒精度，保证 UTC ISO 字符串可直接按字典序比较（服务端 LWW 与本地智能清单都依赖此性质）。
 */
object TimeUtils {

    private const val ISO_PATTERN = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"

    private fun isoFormat(): SimpleDateFormat =
        SimpleDateFormat(ISO_PATTERN, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }

    fun nowIso(): String = isoFormat().format(Date())

    fun formatIso(date: Date): String = isoFormat().format(date)

    fun parseIso(value: String?): Date? {
        if (value.isNullOrBlank()) return null
        return runCatching { isoFormat().parse(value) }.getOrNull()
    }

    fun startOfTodayIso(): String {
        val c = Calendar.getInstance()
        c.set(Calendar.HOUR_OF_DAY, 0)
        c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        return formatIso(c.time)
    }

    fun endOfTodayIso(): String = plusDaysIso(startOfTodayIso(), 1)

    // ---------------- 本地日期键（yyyy-MM-dd） ----------------

    private fun localDateFmt() = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    /** 设备本地时区的日期键，如 2026-10-13。 */
    fun localDateKey(date: Date = Date()): String = localDateFmt().format(date)

    fun todayKey(): String = localDateKey()

    /** 今天是一周中的第几天（0=周一 … 6=周日），用于热力图按周对齐。 */
    fun mondayIndexToday(): Int {
        val c = Calendar.getInstance()
        return (c.get(Calendar.DAY_OF_WEEK) + 5) % 7
    }

    /** ISO（含 00:00:00Z）→ yyyy-MM-dd。 */
    fun isoDateKey(iso: String?): String? =
        iso?.takeIf { it.length >= 10 }?.substring(0, 10)

    fun dateKeyDaysAgo(days: Int): String {
        val c = Calendar.getInstance()
        c.add(Calendar.DAY_OF_YEAR, -days)
        return localDateKey(c.time)
    }

    /**
     * 日期键 -> UTC 零点 ISO。服务端习惯记录按 @db.Date 存储且用 UTC 切片取日期键，
     * 因此必须把「本地日历日」编码为 UTC 零点，才能与其 todayKey(tz) 对齐。
     */
    fun utcMidnightIso(dateKey: String): String = "${dateKey}T00:00:00.000Z"

    /** dateKey(2026-10-13) -> 10-13。 */
    fun shortDate(dateKey: String): String =
        if (dateKey.length >= 10) dateKey.substring(5) else dateKey

    /** 今天某整点（本地时区）。 */
    fun atTodayHourIso(hour: Int): String {
        val c = Calendar.getInstance()
        c.set(Calendar.HOUR_OF_DAY, hour)
        c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        return formatIso(c.time)
    }

    fun isOverdue(value: String?): Boolean {
        val date = parseIso(value) ?: return false
        return date.time < System.currentTimeMillis()
    }

    fun isToday(value: String?): Boolean {
        val date = parseIso(value) ?: return false
        val cal = Calendar.getInstance().apply { time = date }
        val now = Calendar.getInstance()
        return cal.get(Calendar.YEAR) == now.get(Calendar.YEAR) &&
            cal.get(Calendar.DAY_OF_YEAR) == now.get(Calendar.DAY_OF_YEAR)
    }

    fun plusDaysIso(baseIso: String, days: Int): String {
        val c = Calendar.getInstance()
        c.time = parseIso(baseIso) ?: Date()
        c.add(Calendar.DAY_OF_YEAR, days)
        return formatIso(c.time)
    }

    /** 界面展示用：今天/明天/昨天 + 时间，其它显示 M月d日。 */
    fun displayDue(value: String?): String? {
        val date = parseIso(value) ?: return null
        val cal = Calendar.getInstance().apply { time = date }
        val today = Calendar.getInstance()
        val sameYear = cal.get(Calendar.YEAR) == today.get(Calendar.YEAR)
        val dayDiff = dayDiff(today, cal)
        val hm = SimpleDateFormat("HH:mm", Locale.CHINA).format(date)
        val datePart = when (dayDiff) {
            0 -> "今天"
            1 -> "明天"
            -1 -> "昨天"
            else -> SimpleDateFormat(if (sameYear) "M月d日" else "yyyy年M月d日", Locale.CHINA).format(date)
        }
        val midnight = cal.get(Calendar.HOUR_OF_DAY) == 0 && cal.get(Calendar.MINUTE) == 0
        return if (midnight) datePart else "$datePart $hm"
    }

    private fun dayDiff(from: Calendar, to: Calendar): Int {
        val a = Calendar.getInstance().apply {
            time = from.time
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        val b = Calendar.getInstance().apply {
            time = to.time
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        val diff = b.timeInMillis - a.timeInMillis
        return (diff / (24 * 60 * 60 * 1000)).toInt()
    }
}