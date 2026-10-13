package com.tickflow.app.feature.habits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.network.dto.HabitTemplateDto
import com.tickflow.app.core.network.dto.HabitUpsertRequest
import com.tickflow.app.core.network.dto.HabitWithRecordsDto
import com.tickflow.app.core.repository.HabitsRepository
import com.tickflow.app.core.util.TimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 热力图单元格：-1 表示未来日期（留空）。 */
data class HabitCard(
    val id: String,
    val name: String,
    val icon: String?,
    val color: Int?,
    val goalType: Int,
    val targetValue: Int,
    val unit: String?,
    val frequency: Int,
    val weekDays: List<Int>,
    val archived: Boolean,
    val todayValue: Int,
    val currentStreak: Int,
    val longestStreak: Int,
    val heat: List<Int>,
)

data class HabitsUiState(
    val loading: Boolean = false,
    val habits: List<HabitCard> = emptyList(),
    val templates: List<HabitTemplateDto> = emptyList(),
    val message: String? = null,
)

private const val HEAT_WEEKS = 12
private const val HEAT_CELLS = HEAT_WEEKS * 7

@HiltViewModel
class HabitsViewModel @Inject constructor(
    private val habitsRepository: HabitsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(HabitsUiState())
    val state: StateFlow<HabitsUiState> = _state

    init {
        reload()
    }

    fun reload() {
        viewModelScope.launch { loadAll(showSpinner = true) }
    }

    private suspend fun loadAll(showSpinner: Boolean) {
        if (showSpinner) _state.update { it.copy(loading = true) }
        val today = TimeUtils.todayKey()
        val from = TimeUtils.dateKeyDaysAgo(HEAT_WEEKS * 7 + 6)

        val habitsResult = habitsRepository.habits()
        val statsResult = habitsRepository.stats(from, today)
        habitsResult
            .onSuccess { habits ->
                val statsMap = statsResult.getOrDefault(emptyList()).associateBy { it.habitId }
                val cards = habits.map { habit ->
                    val stat = statsMap[habit.id]
                    toCard(
                        habit = habit,
                        currentStreak = stat?.currentStreak ?: 0,
                        longestStreak = stat?.longestStreak ?: 0,
                        heatValues = stat?.days?.associate { it.date to it.value } ?: emptyMap(),
                        today = today,
                    )
                }
                _state.update { it.copy(loading = false, habits = cards) }
            }
            .onFailure { e -> _state.update { it.copy(loading = false, message = e.message ?: "加载失败") } }

        habitsRepository.templates().onSuccess { list -> _state.update { it.copy(templates = list) } }
    }

    private fun toCard(
        habit: HabitWithRecordsDto,
        currentStreak: Int,
        longestStreak: Int,
        heatValues: Map<String, Int>,
        today: String,
    ): HabitCard {
        val todayValue = habit.records.firstOrNull { TimeUtils.isoDateKey(it.date) == today }?.value ?: 0
        val startDaysAgo = TimeUtils.mondayIndexToday() + (HEAT_WEEKS - 1) * 7
        val heat = (0 until HEAT_CELLS).map { index ->
            val col = index / 7
            val row = index % 7
            val daysAgo = startDaysAgo - (col * 7 + row)
            if (daysAgo < 0) -1 else heatValues[TimeUtils.dateKeyDaysAgo(daysAgo)] ?: 0
        }
        return HabitCard(
            id = habit.id,
            name = habit.name,
            icon = habit.icon,
            color = habit.color,
            goalType = habit.goalType,
            targetValue = habit.targetValue,
            unit = habit.unit,
            frequency = habit.frequency,
            weekDays = habit.weekDays,
            archived = habit.archived,
            todayValue = todayValue,
            currentStreak = currentStreak,
            longestStreak = longestStreak,
            heat = heat,
        )
    }

    /** 今日打卡：纯打卡型开关；计数型 +1 直到目标（再点重置）。乐观更新 + 失败回滚。 */
    fun toggleToday(card: HabitCard) {
        val today = TimeUtils.todayKey()
        val snapshot = _state.value
        val next = when {
            card.goalType == 1 -> if (card.todayValue > 0) 0 else 1
            card.todayValue >= card.targetValue -> 0
            else -> card.todayValue + 1
        }
        applyLocalToday(card.id, next)
        viewModelScope.launch {
            val result = if (next <= 0) {
                habitsRepository.uncheck(card.id, today)
            } else if (card.goalType == 1) {
                habitsRepository.check(card.id, today, 1)
            } else {
                habitsRepository.check(card.id, today, next)
            }
            result.onFailure { e ->
                _state.value = snapshot
                _state.update { it.copy(message = e.message ?: "打卡失败，已回滚") }
            }
            // 刷新连续天数/热力图
            loadAll(showSpinner = false)
        }
    }

    private fun applyLocalToday(habitId: String, value: Int) {
        _state.update { st ->
            st.copy(
                habits = st.habits.map { if (it.id == habitId) it.copy(todayValue = value) else it },
            )
        }
    }

    fun createCustom(request: HabitUpsertRequest) {
        viewModelScope.launch {
            habitsRepository.create(request)
                .onSuccess { loadAll(showSpinner = false) }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "创建失败") } }
        }
    }

    fun createFromTemplate(templateId: String) {
        viewModelScope.launch {
            habitsRepository.fromTemplate(templateId)
                .onSuccess { loadAll(showSpinner = false) }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "创建失败") } }
        }
    }

    fun updateHabit(id: String, request: HabitUpsertRequest) {
        viewModelScope.launch {
            habitsRepository.update(id, request)
                .onSuccess { loadAll(showSpinner = false) }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "保存失败") } }
        }
    }

    fun setArchived(card: HabitCard, archived: Boolean) {
        viewModelScope.launch {
            habitsRepository.archive(card.id, archived)
                .onSuccess { loadAll(showSpinner = false) }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "操作失败") } }
        }
    }

    fun delete(card: HabitCard) {
        viewModelScope.launch {
            habitsRepository.delete(card.id)
                .onSuccess { loadAll(showSpinner = false) }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "删除失败") } }
        }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }
}