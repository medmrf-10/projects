package io.medmrf.zmenotes.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp

data class ZmeExtendedColors(
    val syncedBg: Color,
    val syncedFg: Color,
    val pendingBg: Color,
    val pendingFg: Color,
    val errorBg: Color,
    val errorFg: Color,
    val cardBorder: Color,
    val subtleSurface: Color
)

private val DarkExtended = ZmeExtendedColors(
    syncedBg = Color(0xFF0A2E1E),
    syncedFg = Color(0xFF4ADE80),
    pendingBg = Color(0xFF2F2207),
    pendingFg = Color(0xFFFBBF24),
    errorBg = Color(0xFF341216),
    errorFg = Color(0xFFF87171),
    cardBorder = Color(0xFF222831),
    subtleSurface = Color(0xFF0D1014)
)

private val LightExtended = ZmeExtendedColors(
    syncedBg = Color(0xFFDCFCE7),
    syncedFg = Color(0xFF15803D),
    pendingBg = Color(0xFFFEF3C7),
    pendingFg = Color(0xFFB45309),
    errorBg = Color(0xFFFEE2E2),
    errorFg = Color(0xFFB91C1C),
    cardBorder = Color(0xFFE2E8F0),
    subtleSurface = Color(0xFFF1F5F9)
)

val LocalZmeColors = staticCompositionLocalOf { DarkExtended }

private val OledDarkColorScheme = darkColorScheme(
    primary = Color(0xFF2DD4BF),
    onPrimary = Color(0xFF042420),
    primaryContainer = Color(0xFF0F3D38),
    onPrimaryContainer = Color(0xFF99F6E4),
    secondary = Color(0xFF5EEAD4),
    onSecondary = Color(0xFF062925),
    secondaryContainer = Color(0xFF162426),
    onSecondaryContainer = Color(0xFFCCFBF1),
    background = Color(0xFF000000),
    onBackground = Color(0xFFF1F5F9),
    surface = Color(0xFF0A0D10),
    onSurface = Color(0xFFF1F5F9),
    surfaceVariant = Color(0xFF13181E),
    onSurfaceVariant = Color(0xFF94A3B8),
    outline = Color(0xFF26303D),
    outlineVariant = Color(0xFF1A2029),
    error = Color(0xFFF87171),
    onError = Color(0xFF3B090C)
)

private val CrispLightColorScheme = lightColorScheme(
    primary = Color(0xFF0D9488),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFCCFBF1),
    onPrimaryContainer = Color(0xFF0F3D38),
    secondary = Color(0xFF0F766E),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFE6FFFA),
    onSecondaryContainer = Color(0xFF115E59),
    background = Color(0xFFF8FAFC),
    onBackground = Color(0xFF0F172A),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF475569),
    outline = Color(0xFFCBD5E1),
    outlineVariant = Color(0xFFE2E8F0),
    error = Color(0xFFDC2626),
    onError = Color(0xFFFFFFFF)
)

private val ArabicFriendlyTypography = Typography(
    headlineSmall = TextStyle(
        fontSize = 22.sp,
        lineHeight = 30.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.sp
    ),
    titleLarge = TextStyle(
        fontSize = 20.sp,
        lineHeight = 28.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.sp
    ),
    titleMedium = TextStyle(
        fontSize = 16.sp,
        lineHeight = 24.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.sp
    ),
    titleSmall = TextStyle(
        fontSize = 14.sp,
        lineHeight = 20.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.sp
    ),
    bodyLarge = TextStyle(
        fontSize = 16.sp,
        lineHeight = 26.sp,
        fontWeight = FontWeight.Normal,
        letterSpacing = 0.sp
    ),
    bodyMedium = TextStyle(
        fontSize = 14.sp,
        lineHeight = 22.sp,
        fontWeight = FontWeight.Normal,
        letterSpacing = 0.sp
    ),
    bodySmall = TextStyle(
        fontSize = 12.sp,
        lineHeight = 18.sp,
        fontWeight = FontWeight.Normal,
        letterSpacing = 0.sp
    ),
    labelLarge = TextStyle(
        fontSize = 15.sp,
        lineHeight = 20.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.sp
    ),
    labelMedium = TextStyle(
        fontSize = 13.sp,
        lineHeight = 18.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.sp
    )
)

@Composable
fun ZmeNotesTheme(
    darkTheme: Boolean,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) OledDarkColorScheme else CrispLightColorScheme
    val extended = if (darkTheme) DarkExtended else LightExtended

    CompositionLocalProvider(
        LocalLayoutDirection provides LayoutDirection.Rtl,
        LocalZmeColors provides extended
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = ArabicFriendlyTypography,
            content = content
        )
    }
}
