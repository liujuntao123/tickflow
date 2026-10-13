package com.tickflow.app.feature.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.database.TaskEntity
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
        it.copy(dueDate = dueDate, isAllDay = isAllDay)
    }

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