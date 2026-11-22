package io.medmrf.zmenotes.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.medmrf.zmenotes.model.NoteRecord
import io.medmrf.zmenotes.model.SyncStatus
import io.medmrf.zmenotes.ui.BannerTone
import io.medmrf.zmenotes.ui.ZmeAppController
import io.medmrf.zmenotes.ui.theme.LocalZmeColors
import java.util.Locale

@Composable
fun HistoryScreen(
    controller: ZmeAppController,
    modifier: Modifier = Modifier
) {
    val ext = LocalZmeColors.current
    val clipboard = LocalClipboardManager.current
    var pendingDeleteNote by remember { mutableStateOf<NoteRecord?>(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        controller.statusBanner?.let { banner ->
            StatusBannerCard(
                banner = banner,
                onDismiss = controller::dismissBanner,
                modifier = Modifier.testTag("banner_history_status")
            )
        }

        // Summary & Batch Sync Header
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, ext.cardBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = String.format(Locale.US, "السجل المحلي (%d)", controller.notes.size),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = if (controller.pendingCount > 0) {
                            String.format(Locale.US, "قيد الانتظار: %d", controller.pendingCount)
                        } else {
                            "كل الملاحظات متزامنة ✓"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = if (controller.pendingCount > 0) ext.pendingFg else ext.syncedFg
                    )
                }

                if (controller.pendingCount > 0) {
                    Button(
                        onClick = { controller.syncAllPending(silent = false) },
                        enabled = !controller.isSyncingBatch,
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        ),
                        modifier = Modifier.testTag("btn_sync_pending")
                    ) {
                        if (controller.isSyncingBatch) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("جارٍ المزامنة...")
                        } else {
                            Icon(
                                imageVector = Icons.Rounded.Sync,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "مزامنة المعلّق",
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }
                }
            }
        }

        if (controller.notes.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "لا توجد ملاحظات محفوظة بعد",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "اكتب أول ملاحظة في تبويب «تدوين» وستظهر هنا فوراً مع حالة مزامنتها.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .testTag("history_list"),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(bottom = 16.dp)
            ) {
                items(items = controller.notes, key = { it.id }) { note ->
                    NoteHistoryCard(
                        note = note,
                        isSyncingThis = controller.syncingNoteId == note.id || controller.isSyncingBatch,
                        onRetrySync = { controller.syncSingleNote(note.id) },
                        onCopy = {
                            clipboard.setText(AnnotatedString(note.content))
                            controller.showTransientMessage("تم نسخ نص الملاحظة", BannerTone.INFO)
                        },
                        onDeleteRequest = { pendingDeleteNote = note }
                    )
                }
            }
        }
    }

    pendingDeleteNote?.let { target ->
        AlertDialog(
            onDismissRequest = { pendingDeleteNote = null },
            title = { Text("حذف السجل المحلي؟") },
            text = {
                Text(
                    "سيُحذف هذا السجل من الهاتف فقط ولن يتأثر ما تمت مزامنته مسبقاً في المستودع."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        controller.deleteNote(target.id)
                        pendingDeleteNote = null
                    }
                ) {
                    Text(
                        text = "حذف",
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDeleteNote = null }) {
                    Text("إلغاء")
                }
            }
        )
    }
}

@Composable
private fun NoteHistoryCard(
    note: NoteRecord,
    isSyncingThis: Boolean,
    onRetrySync: () -> Unit,
    onCopy: () -> Unit,
    onDeleteRequest: () -> Unit
) {
    val ext = LocalZmeColors.current
    var expanded by remember(note.id) { mutableStateOf(false) }
    val isSynced = note.syncStatus == SyncStatus.SYNCED

    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, ext.cardBorder),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Top Row: Status badge + Timestamp
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = if (isSynced) ext.syncedBg else ext.pendingBg
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = if (isSynced) Icons.Rounded.CheckCircle else Icons.Rounded.Schedule,
                            contentDescription = null,
                            tint = if (isSynced) ext.syncedFg else ext.pendingFg,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = if (isSynced) "متزامن ✓" else "قيد الانتظار",
                            style = MaterialTheme.typography.labelMedium,
                            color = if (isSynced) ext.syncedFg else ext.pendingFg,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Text(
                    text = "${note.formattedDate} • ${note.formattedTime}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Metadata tags: category + optional intensity
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Text(
                        text = note.category,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }

                note.intensity?.let { level ->
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
                    ) {
                        Text(
                            text = String.format(Locale.US, "الشدة: %d/5", level),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }
            }

            // Note preview text
            Text(
                text = note.content,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = if (expanded) Int.MAX_VALUE else 4,
                overflow = TextOverflow.Ellipsis
            )

            if (!isSynced && !note.lastError.isNullOrBlank()) {
                Text(
                    text = note.lastError,
                    style = MaterialTheme.typography.bodySmall,
                    color = ext.errorFg
                )
            }

            HorizontalDivider(color = ext.cardBorder.copy(alpha = 0.7f))

            // Action row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (!isSynced) {
                    TextButton(
                        onClick = onRetrySync,
                        enabled = !isSyncingThis,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        if (isSyncingThis) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(14.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Rounded.Sync,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "مزامنة الآن",
                            style = MaterialTheme.typography.labelMedium
                        )
                    }
                }

                TextButton(
                    onClick = onCopy,
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ContentCopy,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "نسخ",
                        style = MaterialTheme.typography.labelMedium
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                TextButton(
                    onClick = onDeleteRequest,
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.DeleteOutline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "حذف",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}
