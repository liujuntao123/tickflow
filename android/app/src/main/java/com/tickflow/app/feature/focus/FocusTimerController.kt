package com.tickflow.app.feature.focus

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * 前台服务与 ViewModel 之间的进程内桥接（同一进程，避免广播/绑定开销）：
 * - ViewModel 每秒写 [tick]，服务据此刷新常驻通知；
 * - 服务通知按钮点击 → 写入 [events]，ViewModel 消费（暂停/继续/放弃）。
 */
object FocusTimerController {

    data class Tick(
        val title: String,
        val remainingSeconds: Int,
        val running: Boolean,
        val phaseLabel: String,
    )

    sealed interface Event {
        data object Pause : Event
        data object Resume : Event
        data object GiveUp : Event
    }

    private val _tick = MutableStateFlow<Tick?>(null)
    val tick: StateFlow<Tick?> = _tick

    private val _events = MutableSharedFlow<Event>(extraBufferCapacity = 8)
    val events: SharedFlow<Event> = _events

    fun publish(tick: Tick?) {
        _tick.value = tick
    }

    fun emit(event: Event) {
        _events.tryEmit(event)
    }
}