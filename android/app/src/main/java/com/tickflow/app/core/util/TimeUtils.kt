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