package com.tickflow.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = Blue40,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    primaryContainer = androidx.compose.ui.graphics.Color(0xFFDCE6FF),
    onPrimaryContainer = BlueGrey10,
    background = LightBackground,
    onBackground = androidx.compose.ui.graphics.Color(0xFF14171C),
    surface = LightSurface,
    onSurface = androidx.compose.ui.graphics.Color(0xFF14171C),
    surfaceVariant = LightSurfaceVariant,
    onSurfaceVariant = androidx.compose.ui.graphics.Color(0xFF525A66),
    outline = LightOutline,
)

private val DarkColors = darkColorScheme(
    primary = Blue80,
    onPrimary = BlueGrey10,
    primaryContainer = androidx.compose.ui.graphics.Color(0xFF22325C),
    onPrimaryContainer = androidx.compose.ui.graphics.Color(0xFFDCE6FF),
    background = DarkBackground,
    onBackground = androidx.compose.ui.graphics.Color(0xFFE6E9EF),
    surface = DarkSurface,
    onSurface = androidx.compose.ui.graphics.Color(0xFFE6E9EF),
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = androidx.compose.ui.graphics.Color(0xFF9AA3B2),
    outline = DarkOutline,
)

@Composable
fun TickFlowTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = TickFlowTypography,
        content = content,
    )
}