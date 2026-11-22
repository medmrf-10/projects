package io.medmrf.zmenotes.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.medmrf.zmenotes.model.NoteCategories
import io.medmrf.zmenotes.ui.BannerTone
import io.medmrf.zmenotes.ui.StatusBanner
import io.medmrf.zmenotes.ui.ZmeAppController
import io.medmrf.zmenotes.ui.theme.LocalZmeColors
import java.util.Locale

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ComposeScreen(
    controller: ZmeAppController,
    onVoiceDictationClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val ext = LocalZmeColors.current
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .imePadding()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        controller.statusBanner?.let { banner ->
            StatusBannerCard(
                banner = banner,
                onDismiss = controller::dismissBanner,
                modifier = Modifier.testTag("banner_status")
            )
        }

        if (controller.pendingCount > 0 && controller.config.isConfigured()) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = ext.pendingBg,
                border = BorderStroke(1.dp, ext.pendingFg.copy(alpha = 0.25f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = String.format(
                            Locale.US,
                            "لديك %d ملاحظة بانتظار المزامنة",
                            controller.pendingCount
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = ext.pendingFg,
                        fontWeight = FontWeight.Medium
                    )
                    TextButton(
                        onClick = { controller.syncAllPending(silent = false) },
                        enabled = !controller.isSyncingBatch,
                        modifier = Modifier.testTag("btn_sync_pending_quick")
                    ) {
                        if (controller.isSyncingBatch) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = ext.pendingFg
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Rounded.Sync,
                                contentDescription = null,
                                tint = ext.pendingFg,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "مزامنة المعلّق",
                                color = ext.pendingFg,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        // Main Zero-Friction Note Composer Card
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, ext.cardBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "التقط الفكرة الآن",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (controller.noteDraft.isNotEmpty()) {
                            IconButton(
                                onClick = { controller.noteDraft = "" },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Close,
                                    contentDescription = "مسح النص",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        OutlinedButton(
                            onClick = onVoiceDictationClick,
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            border = BorderStroke(
                                1.dp,
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                            ),
                            modifier = Modifier.testTag("btn_voice_dictation")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Mic,
                                contentDescription = "إملاء صوتي",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "إملاء صوتي",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = controller.noteDraft,
                    onValueChange = { controller.noteDraft = it },
                    placeholder = {
                        Text(
                            text = "اكتب ما يخطر ببالك أو ما تشعر به الآن بحرية دون تنميق...",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    },
                    textStyle = MaterialTheme.typography.bodyLarge.copy(
                        color = MaterialTheme.colorScheme.onSurface
                    ),
                    minLines = 5,
                    maxLines = 10,
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = ext.cardBorder,
                        focusedContainerColor = ext.subtleSurface,
                        unfocusedContainerColor = ext.subtleSurface
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("note_input")
                )
            }
        }

        // Quick Category Chips (1-tap optional)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "التصنيف السريع (اختياري)",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                NoteCategories.ALL.forEachIndexed { index, category ->
                    val selected = controller.selectedCategory == category
                    FilterChip(
                        selected = selected,
                        onClick = {
                            controller.selectedCategory = if (selected) null else category
                        },
                        label = {
                            Text(
                                text = category,
                                style = MaterialTheme.typography.labelMedium
                            )
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                        ),
                        modifier = Modifier.testTag("chip_category_$index")
                    )
                }
            }
        }

        // Quick Intensity / Energy Selector (1 to 5 optional)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "مستوى الشدة أو الطاقة (اختياري)",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                controller.selectedIntensity?.let { level ->
                    Text(
                        text = intensityLabel(level),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                for (level in 1..5) {
                    val isSelected = controller.selectedIntensity == level
                    Surface(
                        onClick = {
                            controller.selectedIntensity = if (isSelected) null else level
                        },
                        shape = RoundedCornerShape(14.dp),
                        color = if (isSelected) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.surface
                        },
                        border = BorderStroke(
                            width = 1.dp,
                            color = if (isSelected) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                ext.cardBorder
                            }
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("btn_intensity_$level")
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = String.format(Locale.US, "%d", level),
                                style = MaterialTheme.typography.titleMedium,
                                color = if (isSelected) {
                                    MaterialTheme.colorScheme.onPrimary
                                } else {
                                    MaterialTheme.colorScheme.onSurface
                                },
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(2.dp))

        // Primary CTA Button
        Button(
            onClick = controller::submitNote,
            enabled = controller.noteDraft.isNotBlank() && !controller.isSubmitting,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .testTag("btn_send_note")
        ) {
            if (controller.isSubmitting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(22.dp),
                    strokeWidth = 2.5.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "جارٍ الحفظ والإرسال...",
                    style = MaterialTheme.typography.labelLarge
                )
            } else {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.Send,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "إرسال إلى المستودع",
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }

        val hintText = if (controller.config.isConfigured()) {
            "تُحفظ الملاحظة محلياً أولاً ثم تُزامَن مباشرة مع مستودع ${controller.config.repo}"
        } else {
            "تُحفظ الملاحظة محلياً فوراً حتى دون إعداد الرمز — أضف رمز GitHub من تبويب الإعدادات للمزامنة"
        }
        Text(
            text = hintText,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp)
        )
    }
}

private fun intensityLabel(level: Int): String = when (level) {
    1 -> "1/5 خفيف جداً"
    2 -> "2/5 خفيف"
    3 -> "3/5 متوسط"
    4 -> "4/5 ملحوظ"
    5 -> "5/5 مرتفع"
    else -> ""
}

@Composable
fun StatusBannerCard(
    banner: StatusBanner,
    onDismiss: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val ext = LocalZmeColors.current
    val (bg, fg, icon) = when (banner.tone) {
        BannerTone.SUCCESS -> Triple(ext.syncedBg, ext.syncedFg, Icons.Rounded.CheckCircle)
        BannerTone.PENDING -> Triple(ext.pendingBg, ext.pendingFg, Icons.Rounded.CloudOff)
        BannerTone.INFO -> Triple(
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f),
            MaterialTheme.colorScheme.onPrimaryContainer,
            Icons.Rounded.Info
        )
        BannerTone.ERROR -> Triple(ext.errorBg, ext.errorFg, Icons.Rounded.ErrorOutline)
    }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = bg,
        border = BorderStroke(1.dp, fg.copy(alpha = 0.25f)),
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = fg,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = banner.message,
                style = MaterialTheme.typography.bodyMedium,
                color = fg,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            if (onDismiss != null) {
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Close,
                        contentDescription = "إغلاق",
                        tint = fg,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}
