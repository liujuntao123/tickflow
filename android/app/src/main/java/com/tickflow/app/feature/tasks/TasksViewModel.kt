package com.tickflow.app.feature.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.core.repository.OrgRepository
import com.tickflow.app.core.repository.TaskRepository
import com.tickflow.app.core.sync.SyncEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SmartList(val key: String, val label: String)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class TasksViewModel @Inject constructor(
    private val taskRepo: TaskRepository,
    private val orgRepo: OrgRepository,
    private val syncEngine: SyncEngine,
) : ViewModel() {

    val smartLists = listOf(
        SmartList("inbox", "收件箱"),
        SmartList("today", "今天"),
        SmartList("next7", "未来7天"),
        SmartList("all", "所有"),
    )

    private val scope = viewModelScope
    private val _smart = MutableStateFlow("inbox")
    private val _list = MutableStateFlow<Pair<String, String>?>(null)

    val smart: StateFlow<String> = _smart
    val selectedListId: StateFlow<String?> =
        _list.map { it?.first }.stateIn(scope, SharingStarted.WhileSubscribed(5_000), null)

    val inbox = orgRepo.observeInbox().stateIn(scope, SharingStarted.WhileSubscribed(5_000), null)
    val lists = orgRepo.observeLists().stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val folders = orgRepo.observeFolders().stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val tags = orgRepo.observeTags().stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val isSyncing: StateFlow<Boolean> = syncEngine.isSyncing
    val syncMessage: StateFlow<String?> = syncEngine.lastMessage

    /** 每个父任务的子任务数量，用于任务行展示。 */
    val subtaskCounts: StateFlow<Map<String, Int>> =
        taskRepo.observeSubtaskCounts()
            .map { counts -> counts.associate { it.parentId to it.cnt } }
            .stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyMap())

    val title: StateFlow<String> =
        combine(_smart, _list, inbox) { smart, list, _ ->
            list?.second ?: (smartLists.firstOrNull { it.key == smart }?.label ?: "任务")
        }.stateIn(scope, SharingStarted.WhileSubscribed(5_000), "收件箱")

    val tasks: StateFlow<List<TaskEntity>> =
        combine(_smart, _list, inbox) { smart, list, inboxList -> Triple(smart, list, inboxList) }
            .flatMapLatest { (smart, list, inboxList) ->
                when {
                    list != null -> taskRepo.observeByList(list.first)
                    smart == "today" -> taskRepo.observeToday()
                    smart == "next7" -> taskRepo.observeNext7()
                    smart == "all" -> taskRepo.observeActive()
                    else -> inboxList?.let { taskRepo.observeInbox(it.id) } ?: flowOf(emptyList())
                }
            }
            .stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun selectSmartList(key: String) {
        _smart.value = key
        _list.value = null
    }

    fun selectList(id: String, name: String) {
        _list.value = id to name
    }

    fun createList(name: String) {
        viewModelScope.launch {
            val id = orgRepo.createList(name)
            _list.value = id to name.trim()
        }
    }

    fun quickAdd(title: String, listId: String?, dueDate: String?, priority: Int, isAllDay: Boolean) {
        if (title.isBlank()) return
        viewModelScope.launch {
            taskRepo.createTask(
                title = title,
                listId = listId ?: _list.value?.first,
                dueDate = dueDate,
                priority = priority,
                isAllDay = isAllDay,
            )
        }
    }

    fun toggleComplete(task: TaskEntity) {
        viewModelScope.launch { taskRepo.toggleComplete(task) }
    }

    fun clearSyncMessage() = syncEngine.clearMessage()
}