package com.tickflow.app.feature.focus

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.core.network.dto.FocusByDayDto
import com.tickflow.app.core.network.dto.FocusSessionDto
import com.tickflow.app.core.network.dto.FocusSettingsPayload
import com.tickflow.app.core.repository.FocusRepository
import com.tickflow.app.core.repository.TaskRepository
import com.tickflow.app.core.repository.UserSettingsRepository
import com.tickflow.app.core.util.TimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class FocusPhase(val label: String) {
    FOCUS("专注"),
    SHORT_BREAK("短休息"),
    LONG_BREAK("长休息"),
}

data class FocusUiState(
    val phase: FocusPhase = FocusPhase.FOCUS,
    val active: Boolean = false,
    val running: Boolean = false,
    val paused: Boolean = false,
    val totalSeconds: Int = 25 * 60,
    val remainingSeconds: Int = 25 * 60,
    val sessionId: String? = null,
    val selectedTaskId: String? = null,
    val completedPomodoros: Int = 0,
    val todaySeconds: Int = 0,
    val todayCount: Int = 0,
    val week: List<FocusByDayDto> = emptyList(),
    val settings: FocusSettingsPayload = FocusSettingsPayload(),
    val message: String? = null,
)

@HiltViewModel
class FocusViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val focusRepository: FocusRepository,
    private val userSettingsRepository: UserSettingsRepository,
    taskRepository: TaskRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(FocusUiState())
    val state: StateFlow<FocusUiState> = _state

    val tasks: StateFlow<List<TaskEntity>> =
        taskRepository.observeToday().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** 防止剩余归零时重复触发阶段切换。 */
    private var transitioning = false

    init {
        observeServiceEvents()
        viewModelScope.launch {
            userSettingsRepository.focusSettings.collect { settings ->
                _state.update { st ->
                    if (st.active) {
                        st.copy(settings = settings)
                    } else {
                        val total = settings.focusMinutes * 60
                        st.copy(settings = settings, totalSeconds = total, remainingSeconds = total)
                    }
                }
            }
        }
        viewModelScope.launch {
            userSettingsRepository.refresh()
            restoreCurrent()
            refreshStats()
        }
        startTicker()
    }

    // ---------------- 常驻计时器 ----------------

    private fun startTicker() {
        viewModelScope.launch {
            while (isActive) {
                delay(1000)
                val st = _state.value
                if (!st.active || !st.running) continue
                val remaining = (st.remainingSeconds - 1).coerceAtLeast(0)
                _state.update { it.copy(remainingSeconds = remaining) }
                publishTick()
                if (remaining == 0 && !transitioning) {
                    transitioning = true
                    viewModelScope.launch {
                        try {
                            onPhaseFinished()
                        } finally {
                            transitioning = false
                        }
                    }
                }
            }
        }
    }

    // ---------------- 用户操作 ----------------

    fun selectTask(taskId: String?) {
        _state.update { it.copy(selectedTaskId = taskId) }
    }

    fun startFocus() {
        val st = _state.value
        if (st.active) return
        val planned = st.settings.focusMinutes * 60
        viewModelScope.launch {
            focusRepository.createSession(st.selectedTaskId, planned)
                .onSuccess { session ->
                    _state.update {
                        it.copy(
                            active = true,
                            running = true,
                            paused = false,
                            phase = FocusPhase.FOCUS,
                            sessionId = session.id,
                            totalSeconds = planned,
                            remainingSeconds = planned,
                        )
                    }
                    startService()
                    publishTick()
                }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "创建专注失败") } }
        }
    }

    fun togglePause() {
        val st = _state.value
        if (!st.active) return
        if (st.phase != FocusPhase.FOCUS) {
            // 休息阶段纯本地
            _state.update { it.copy(running = !it.running, paused = it.running) }
            publishTick()
            return
        }
        val id = st.sessionId ?: return
        val action = if (st.running) "pause" else "resume"
        viewModelScope.launch {
            focusRepository.patch(id, action)
                .onSuccess {
                    _state.update { s -> s.copy(running = action == "resume", paused = action == "pause") }
                    publishTick()
                }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "操作失败") } }
        }
    }

    fun giveUp() {
        val st = _state.value
        val id = st.sessionId
        viewModelScope.launch {
            if (st.phase == FocusPhase.FOCUS && id != null) {
                val elapsed = (st.totalSeconds - st.remainingSeconds).coerceAtLeast(0)
                focusRepository.patch(id, "cancel", actualSeconds = elapsed)
            }
            resetToIdle(st.settings)
            stopService()
            refreshStats()
        }
    }

    /** 手动结束当前阶段（专注=完成；休息=跳过休息）。 */
    fun completeNow() {
        if (!_state.value.active || transitioning) return
        transitioning = true
        viewModelScope.launch {
            try {
                onPhaseFinished()
            } finally {
                transitioning = false
            }
        }
    }

    fun updateFocusSettings(payload: FocusSettingsPayload) {
        viewModelScope.launch {
            userSettingsRepository.setFocusSettings(payload)
                .onSuccess { _state.update { it.copy(message = "配置已保存") } }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "保存失败") } }
        }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    // ---------------- 阶段切换 ----------------

    private suspend fun onPhaseFinished() {
        _state.update { it.copy(running = false) }
        when (_state.value.phase) {
            FocusPhase.FOCUS -> finishFocusPhase()
            FocusPhase.SHORT_BREAK, FocusPhase.LONG_BREAK -> finishBreakPhase()
        }
    }

    private suspend fun finishFocusPhase() {
        val st = _state.value
        val elapsed = (st.totalSeconds - st.remainingSeconds).coerceAtLeast(0)
        val actual = if (elapsed > 0) elapsed else st.totalSeconds
        val completed = st.completedPomodoros + 1
        val useLong = st.settings.longBreakEvery > 0 && completed % st.settings.longBreakEvery == 0
        val breakSeconds = if (useLong) st.settings.longBreakMinutes * 60 else st.settings.shortBreakMinutes * 60

        st.sessionId?.let { id ->
            focusRepository.patch(id, "complete", actualSeconds = actual, breakSeconds = breakSeconds)
        }

        if (st.settings.autoStartNext) {
            val breakTotal = breakSeconds.coerceAtLeast(1)
            _state.update {
                it.copy(
                    phase = if (useLong) FocusPhase.LONG_BREAK else FocusPhase.SHORT_BREAK,
                    active = true,
                    running = true,
                    paused = false,
                    sessionId = null,
                    totalSeconds = breakTotal,
                    remainingSeconds = breakTotal,
                    completedPomodoros = completed,
                )
            }
            startService()
            publishTick()
        } else {
            resetToIdle(st.settings, completedPomodoros = completed)
            stopService()
        }
        refreshStats()
    }

    private suspend fun finishBreakPhase() {
        val st = _state.value
        stopService()
        if (st.settings.autoStartNext) {
            _state.update {
                it.copy(
                    phase = FocusPhase.FOCUS,
                    active = false,
                    running = false,
                    paused = false,
                    sessionId = null,
                    totalSeconds = st.settings.focusMinutes * 60,
                    remainingSeconds = st.settings.focusMinutes * 60,
                )
            }
            startFocus()
        } else {
            resetToIdle(st.settings)
        }
    }

    private fun resetToIdle(settings: FocusSettingsPayload, completedPomodoros: Int = 0) {
        _state.update {
            it.copy(
                phase = FocusPhase.FOCUS,
                active = false,
                running = false,
                paused = false,
                sessionId = null,
                totalSeconds = settings.focusMinutes * 60,
                remainingSeconds = settings.focusMinutes * 60,
                completedPomodoros = if (completedPomodoros > 0) completedPomodoros else it.completedPomodoros,
            )
        }
    }

    // ---------------- 恢复 / 统计 ----------------

    private suspend fun restoreCurrent() {
        val session = focusRepository.current().getOrNull() ?: return
        if (session.status == 2 || session.status == 3) return
        val startedMs = TimeUtils.parseIso(session.startedAt)?.time ?: return
        val elapsed = ((System.currentTimeMillis() - startedMs) / 1000).toInt()
        val remaining = (session.plannedSeconds - elapsed).coerceAtLeast(0)
        if (remaining == 0) {
            focusRepository.patch(session.id, "complete", actualSeconds = session.plannedSeconds)
            return
        }
        val paused = session.status == 1
        _state.update {
            it.copy(
                phase = FocusPhase.FOCUS,
                active = true,
                running = !paused,
                paused = paused,
                sessionId = session.id,
                selectedTaskId = session.taskId,
                totalSeconds = session.plannedSeconds,
                remainingSeconds = remaining,
            )
        }
        startService()
        publishTick()
    }

    private suspend fun refreshStats() {
        val to = TimeUtils.todayKey()
        val fromIso = TimeUtils.utcMidnightIso(TimeUtils.dateKeyDaysAgo(6))
        // to 用「明天本地零点」确保包含今天全部会话（服务端按 startedAt 区间过滤）
        val toIso = TimeUtils.plusDaysIso(TimeUtils.startOfTodayIso(), 1)
        focusRepository.stats(fromIso, toIso).onSuccess { stats ->
            val byDate = stats.byDay.associateBy { it.date }
            val week = (6 downTo 0).map { offset ->
                val key = TimeUtils.dateKeyDaysAgo(offset)
                val day = byDate[key]
                FocusByDayDto(date = key, totalSeconds = day?.totalSeconds ?: 0, count = day?.count ?: 0)
            }
            val today = byDate[to]
            _state.update {
                it.copy(
                    todaySeconds = today?.totalSeconds ?: 0,
                    todayCount = today?.count ?: 0,
                    week = week,
                )
            }
        }
    }

    // ---------------- 服务桥接 ----------------

    private fun observeServiceEvents() {
        viewModelScope.launch {
            FocusTimerController.events.collect { event ->
                when (event) {
                    FocusTimerController.Event.Pause -> if (_state.value.running) togglePause()
                    FocusTimerController.Event.Resume -> if (!_state.value.running) togglePause()
                    FocusTimerController.Event.GiveUp -> giveUp()
                }
            }
        }
    }

    private fun publishTick() {
        val st = _state.value
        FocusTimerController.publish(
            FocusTimerController.Tick(
                title = serviceTitle(st),
                remainingSeconds = st.remainingSeconds,
                running = st.running,
                phaseLabel = st.phase.label,
            )
        )
    }

    private fun serviceTitle(st: FocusUiState): String = when (st.phase) {
        FocusPhase.FOCUS -> {
            val task = tasks.value.firstOrNull { it.id == st.selectedTaskId }?.title
            if (task.isNullOrBlank()) "专注中" else "专注中 · $task"
        }
        FocusPhase.SHORT_BREAK -> "短休息"
        FocusPhase.LONG_BREAK -> "长休息"
    }

    private fun startService() {
        val st = _state.value
        val intent = Intent(context, FocusTimerService::class.java)
            .setAction(FocusTimerService.ACTION_START)
            .putExtra(FocusTimerService.EXTRA_TITLE, serviceTitle(st))
            .putExtra(FocusTimerService.EXTRA_REMAINING, st.remainingSeconds)
            .putExtra(FocusTimerService.EXTRA_RUNNING, st.running)
        runCatching { ContextCompat.startForegroundService(context, intent) }
    }

    private fun stopService() {
        FocusTimerController.publish(null)
        runCatching { context.stopService(Intent(context, FocusTimerService::class.java)) }
    }

    override fun onCleared() {
        super.onCleared()
        // 计时权威随 VM 消失，停止服务避免通知卡死；会话仍可从服务端恢复
        stopService()
    }
}