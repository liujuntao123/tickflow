package com.tickflow.app.feature.main

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.tickflow.app.core.repository.ModuleFlags
import com.tickflow.app.feature.focus.FocusScreen
import com.tickflow.app.feature.focus.FocusViewModel
import com.tickflow.app.feature.habits.HabitsScreen
import com.tickflow.app.feature.matrix.MatrixScreen
import com.tickflow.app.feature.settings.SettingsScreen
import com.tickflow.app.feature.tasks.TaskDetailScreen
import com.tickflow.app.feature.tasks.TasksScreen
import com.tickflow.app.feature.tasks.TasksViewModel
import kotlinx.coroutines.launch

object Routes {
    const val TASKS = "tasks"
    const val CALENDAR = "calendar"
    const val FOCUS = "focus"
    const val HABITS = "habits"
    const val MATRIX = "matrix"
    const val MORE = "more"
    const val TASK_DETAIL = "task/{taskId}"
    fun taskDetail(id: String) = "task/$id"
}

private data class BottomItem(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val enabled: (ModuleFlags) -> Boolean,
)

private val bottomItems = listOf(
    BottomItem(Routes.TASKS, "任务", Icons.Filled.Checklist) { true },
    BottomItem(Routes.CALENDAR, "日历", Icons.Filled.CalendarMonth) { it.calendar },
    BottomItem(Routes.FOCUS, "专注", Icons.Filled.Timer) { it.pomodoro },
    BottomItem(Routes.HABITS, "习惯", Icons.Filled.Repeat) { it.habits },
    BottomItem(Routes.MORE, "更多", Icons.Filled.MoreHoriz) { true },
)

@Composable
fun MainScreen(
    onSync: () -> Unit,
    openTaskId: String? = null,
    onOpenTaskConsumed: () -> Unit = {},
) {
    val navController = rememberNavController()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    // 活动级共享 VM：抽屉与任务页共用选中清单状态
    val tasksViewModel: TasksViewModel = hiltViewModel()
    // 番茄计时需跨 Tab 存活，故提升到活动级
    val focusViewModel: FocusViewModel = hiltViewModel()
    val mainViewModel: MainViewModel = hiltViewModel()
    val flags by mainViewModel.flags.collectAsStateWithLifecycle()
    val items = remember(flags) { bottomItems.filter { it.enabled(flags) } }

    // 通知点击 → 直达任务详情
    LaunchedEffect(openTaskId) {
        if (!openTaskId.isNullOrBlank()) {
            navController.navigate(Routes.taskDetail(openTaskId)) { launchSingleTop = true }
            onOpenTaskConsumed()
        }
    }

    // 被关闭模块的页面（含直接进入）→ 退回任务页
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    LaunchedEffect(currentRoute, flags) {
        if (currentRoute != null && !mainViewModel.isRouteEnabled(currentRoute, flags)) {
            navController.navigate(Routes.TASKS) {
                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            AppDrawer(
                viewModel = tasksViewModel,
                onClose = { scope.launch { drawerState.close() } },
                onNavigateTasks = {
                    navController.navigate(Routes.TASKS) {
                        popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
            )
        },
    ) {
        Scaffold(
            bottomBar = { BottomBar(navController, items) },
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = Routes.TASKS,
                modifier = Modifier.padding(innerPadding),
            ) {
                composable(Routes.TASKS) {
                    TasksScreen(
                        viewModel = tasksViewModel,
                        onOpenDrawer = { scope.launch { drawerState.open() } },
                        onOpenTask = { navController.navigate(Routes.taskDetail(it)) },
                        onSync = onSync,
                        onOpenMatrix = if (flags.matrix) {
                            { navController.navigate(Routes.MATRIX) { launchSingleTop = true } }
                        } else {
                            null
                        },
                    )
                }
                composable(Routes.CALENDAR) { PlaceholderScreen("日历", "日历视图将在后续版本提供") }
                composable(Routes.FOCUS) { FocusScreen(focusViewModel) }
                composable(Routes.HABITS) { HabitsScreen() }
                composable(Routes.MATRIX) {
                    MatrixScreen(onOpenTask = { navController.navigate(Routes.taskDetail(it)) })
                }
                composable(Routes.MORE) { SettingsScreen() }
                composable(
                    route = Routes.TASK_DETAIL,
                    arguments = listOf(navArgument("taskId") { type = NavType.StringType }),
                ) { entry ->
                    TaskDetailScreen(
                        taskId = entry.arguments?.getString("taskId").orEmpty(),
                        onBack = { navController.popBackStack() },
                    )
                }
            }
        }
    }
}

@Composable
private fun BottomBar(navController: NavHostController, items: List<BottomItem>) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    NavigationBar {
        items.forEach { item ->
            NavigationBarItem(
                selected = currentRoute == item.route,
                onClick = {
                    navController.navigate(item.route) {
                        popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = { Icon(item.icon, contentDescription = item.label) },
                label = { Text(item.label) },
            )
        }
    }
}

@Composable
private fun PlaceholderScreen(title: String, subtitle: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}