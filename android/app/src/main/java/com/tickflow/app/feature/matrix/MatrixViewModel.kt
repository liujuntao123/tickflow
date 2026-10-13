package com.tickflow.app.feature.matrix

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.core.database.effectiveDue
import com.tickflow.app.core.repository.OrgRepository
import com.tickflow.app.core.repository.TaskRepository
import com.tickflow.app.core.util.TimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class Quadrants(
    val q1: List<TaskEntity> = emptyList(),
    val q2: List<TaskEntity> = emptyList(),
    val q3: List<TaskEntity> = emptyList(),
    val q4: List<TaskEntity> = emptyList(),
)

@HiltViewModel
class MatrixViewModel @Inject constructor(
    private val taskRepo: TaskRepository,
    orgRepo: OrgRepository,
) : ViewModel() {

    private val scope = viewModelScope

    val tagMap: StateFlow<Map<String, String>> =
        orgRepo.observeTags().map { tags -> tags.associate { it.id to it.name } }
            .stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyMap())

    val subtaskCounts: StateFlow<Map<String, Int>> =
        taskRepo.observeSubtaskCounts().map { counts -> counts.associate { it.parentId to it.cnt } }
            .stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyMap())

    val quadrants: StateFlow<Quadrants> =
        taskRepo.observeActive()
            .map { tasks -> split(tasks.filter { it.parentId == null }) }
            .stateIn(scope, SharingStarted.WhileSubscribed(5_000), Quadrants())

    private fun split(tasks: List<TaskEntity>): Quadrants {
        val urgentBoundary = TimeUtils.plusDaysIso(TimeUtils.startOfTodayIso(), 2)
        val q1 = mutableListOf<TaskEntity>()
        val q2 = mutableListOf<TaskEntity>()
        val q3 = mutableListOf<TaskEntity>()
        val q4 = mutableListOf<TaskEntity>()
        tasks.forEach { task ->
            val important = task.priority == 3 || task.priority == 5
            val due = task.effectiveDue
            val urgent = due != null && due < urgentBoundary
            when {
                important && urgent -> q1.add(task)
                important -> q2.add(task)
                urgent -> q3.add(task)
                else -> q4.add(task)
            }
        }
        return Quadrants(q1, q2, q3, q4)
    }

    /** 拖拽跨象限只改优先级：重要 → 5；不重要 → 1。紧急维度由到期日推导，不变。 */
    fun setImportant(task: TaskEntity, important: Boolean) {
        val priority = if (important) 5 else 1
        if (task.priority == priority) return
        viewModelScope.launch { taskRepo.updateTask(task.copy(priority = priority)) }
    }

    fun toggleComplete(task: TaskEntity) {
        viewModelScope.launch { taskRepo.toggleComplete(task) }
    }
}