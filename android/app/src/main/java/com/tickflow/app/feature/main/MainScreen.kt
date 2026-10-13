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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
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
    const val MORE = "more"
    const val TASK_DETAIL = "task/{taskId}"
    fun taskDetail(id: String) = "task/$id"
}

private data class BottomItem(val route: String, val label: String, val icon: ImageVector)

private val bottomItems = listOf(
    BottomItem(Routes.TASKS, "任务", Icons.Filled.Checklist),
    BottomItem(Routes.CALENDAR, "日历", Icons.Filled.CalendarMonth),
    BottomItem(Routes.FOCUS, "专注", Icons.Filled.Timer),
    BottomItem(Routes.HABITS, "习惯", Icons.Filled.Repeat),
    BottomItem(Routes.MORE, "更多", Icons.Filled.MoreHoriz),
)

@Composable
fun MainScreen(onSync: () -> Unit) {
    val navController = rememberNavController()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    // 活动级共享 VM：抽屉与任务页共用选中清单状态
    val tasksViewModel: TasksViewModel = hiltViewModel()

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
            bottomBar = { BottomBar(navController) },
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
                    )
                }
                composable(Routes.CALENDAR) { PlaceholderScreen("日历", "M1 占位页 · 日历视图将在 M2 提供") }
                composable(Routes.FOCUS) { PlaceholderScreen("专注", "M1 占位页 · 番茄钟将在 M2 提供") }
                composable(Routes.HABITS) { PlaceholderScreen("习惯", "M1 占位页 · 习惯打卡将在 M2 提供") }
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
private fun BottomBar(navController: NavHostController) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    NavigationBar {
        bottomItems.forEach { item ->
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