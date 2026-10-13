package com.tickflow.app.feature.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.core.network.dto.ReminderDto
import com.tickflow.app.core.repository.OrgRepository
import com.tickflow.app.core.repository.TaskRepository
import com.tickflow.app.core.util.TimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TaskDetailViewModel @Inject constructor(
    private val taskRepo: TaskRepository,
    orgRepo: OrgRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    val taskId: String = savedStateHandle.get<String>("taskId").orEmpty()

    private val scope = viewModelScope

    val task: StateFlow<TaskEntity?> =
        taskRepo.observeById(taskId).stateIn(scope, SharingStarted.WhileSubscribed(5_000), null)

    val subtasks: StateFlow<List<TaskEntity>> =
        taskRepo.observeSubtasks(taskId).stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val tags = orgRepo.observeTags().stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun updateTitle(value: String) {
        if (value.isBlank()) return
        update { it.copy(title = value.trim()) }
    }

    fun updateNotes(value: String) = update { it.copy(notes = value.ifBlank { null }) }

    fun setPriority(priority: Int) = update { it.copy(priority = priority) }

    fun setDueDate(dueDate: String?, isAllDay: Boolean) = update {
        it.copy(
            dueDate = dueDate,
            isAllDay = isAllDay,
            recurrenceDtstart = if (it.recurrenceRule != null) dueDate else it.recurrenceDtstart,
            nextDueDate = null,
        )
    }

    /** 重复规则编辑；rule 为 null 表示清除。dtstart 固定为截止时间作为 RRULE 锚点。 */
    fun setRecurrence(rule: String?, recurrenceEnd: String?, dtstart: String?, repeatFrom: Int) = update { current ->
        if (rule == null) {
            current.copy(
                recurrenceRule = null,
                recurrenceEnd = null,
                recurrenceDtstart = null,
                repeatFrom = 0,
                nextDueDate = null,
            )
        } else {
            current.copy(
                recurrenceRule = rule,
                recurrenceEnd = recurrenceEnd,
                recurrenceDtstart = dtstart ?: current.dueDate,
                repeatFrom = repeatFrom,
                nextDueDate = null,
            )
        }
    }

    fun toggleReminder(offsetMinutes: Int) = update { current ->
        val offsets = (current.reminders?.map { it.offset } ?: emptyList()).toMutableList()
        if (offsets.contains(offsetMinutes)) offsets.remove(offsetMinutes) else offsets.add(offsetMinutes)
        current.copy(
            reminders = if (offsets.isEmpty()) null else offsets.sorted().map { ReminderDto(it) },
        )
    }

    val reminderOptions: List<Pair<Int, String>> = listOf(
        0 to "准时",
        5 to "提前5分钟",
        30 to "提前30分钟",
        60 to "提前1小时",
        1440 to "提前1天",
    )

    fun toggleTag(tagId: String) = update { current ->
        val tags = current.tagIds.toMutableList()
        if (tags.contains(tagId)) tags.remove(tagId) else tags.add(tagId)
        current.copy(tagIds = tags)
    }

    fun toggleComplete() {
        task.value?.let { viewModelScope.launch { taskRepo.toggleComplete(it) } }
    }

    fun addSubtask(title: String) {
        val parent = task.value ?: return
        if (title.isBlank()) return
        viewModelScope.launch { taskRepo.createSubtask(parent, title) }
    }

    fun toggleSubtask(sub: TaskEntity) {
        viewModelScope.launch { taskRepo.toggleComplete(sub) }
    }

    fun deleteSubtask(sub: TaskEntity) {
        viewModelScope.launch { taskRepo.deleteTask(sub.id) }
    }

    fun deleteTask(onDeleted: () -> Unit) {
        viewModelScope.launch {
            taskRepo.deleteTask(taskId)
            onDeleted()
        }
    }

    val dueOptions: List<Triple<String, String?, Boolean>> = listOf(
        Triple("无", null, false),
        Triple("今天", TimeUtils.startOfTodayIso(), true),
        Triple("明天", TimeUtils.plusDaysIso(TimeUtils.startOfTodayIso(), 1), true),
        Triple("下周", TimeUtils.plusDaysIso(TimeUtils.startOfTodayIso(), 7), true),
    )

    private fun update(transform: (TaskEntity) -> TaskEntity) {
        val current = task.value ?: return
        viewModelScope.launch { taskRepo.updateTask(transform(current)) }
    }
}