package com.ayaan.couponviewer.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = CouponViewerColors.Primary,
    secondary = CouponViewerColors.Secondary,
    background = CouponViewerColors.Background,
    surface = CouponViewerColors.Background,
    onPrimary = CouponViewerColors.Background, // White text on Primary
    onSecondary = CouponViewerColors.Background, // White text on Secondary
    onBackground = CouponViewerColors.TextPrimary,
    onSurface = CouponViewerColors.TextPrimary,
    error = CouponViewerColors.Error
)

@Composable
fun CouponViewerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // We disable dynamic color to stick to the brand colors
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}