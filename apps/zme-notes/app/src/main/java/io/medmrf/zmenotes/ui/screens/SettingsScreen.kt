package io.medmrf.zmenotes.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ContentPaste
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Save
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material.icons.rounded.WifiTethering
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import io.medmrf.zmenotes.model.GitHubConfig
import io.medmrf.zmenotes.ui.ZmeAppController
import io.medmrf.zmenotes.ui.theme.LocalZmeColors

@Composable
fun SettingsScreen(
    controller: ZmeAppController,
    modifier: Modifier = Modifier
) {
    val ext = LocalZmeColors.current
    val clipboard = LocalClipboardManager.current
    val scrollState = rememberScrollState()

    var owner by remember { mutableStateOf(controller.config.owner) }
    var repo by remember { mutableStateOf(controller.config.repo) }
    var branch by remember { mutableStateOf(controller.config.branch) }
    var filePath by remember { mutableStateOf(controller.config.filePath) }
    var token by remember { mutableStateOf(controller.config.token) }
    var showToken by remember { mutableStateOf(false) }

    LaunchedEffect(controller.config) {
        owner = controller.config.owner
        repo = controller.config.repo
        branch = controller.config.branch
        filePath = controller.config.filePath
        token = controller.config.token
    }

    fun currentConfig(): GitHubConfig = GitHubConfig(
        owner = owner,
        repo = repo,
        branch = branch,
        filePath = filePath,
        token = token
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .imePadding()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Security Assurance Banner
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Rounded.VerifiedUser,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "حفظ مشفّر عبر Android Keystore",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "يُشفّر رمز GitHub محلياً بخوارزمية AES-256-GCM ولا يُخزَّن أبداً كنص واضح.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // GitHub Connection Status
        controller.connectionBanner?.let { banner ->
            StatusBannerCard(
                banner = banner,
                modifier = Modifier.testTag("connection_status")
            )
        }

        // Repository & Token Form Card
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, ext.cardBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "إعدادات المزامنة مع GitHub",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                LtrSettingField(
                    label = "المالك (Owner)",
                    value = owner,
                    onValueChange = { owner = it },
                    tag = "input_owner"
                )

                LtrSettingField(
                    label = "المستودع (Repo)",
                    value = repo,
                    onValueChange = { repo = it },
                    tag = "input_repo"
                )

                LtrSettingField(
                    label = "الفرع (Branch)",
                    value = branch,
                    onValueChange = { branch = it },
                    tag = "input_branch"
                )

                LtrSettingField(
                    label = "مسار الملف (File Path)",
                    value = filePath,
                    onValueChange = { filePath = it },
                    tag = "input_path"
                )

                // Masked Fine-Grained PAT Input
                OutlinedTextField(
                    value = token,
                    onValueChange = { token = it },
                    label = { Text("رمز الوصول الدقيق (Fine-Grained PAT)") },
                    placeholder = { Text("الصق رمز الوصول الدقيق هنا...") },
                    singleLine = true,
                    visualTransformation = if (showToken) {
                        VisualTransformation.None
                    } else {
                        PasswordVisualTransformation()
                    },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        autoCorrectEnabled = false
                    ),
                    textStyle = MaterialTheme.typography.bodyMedium.copy(
                        textDirection = TextDirection.Ltr
                    ),
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Rounded.Lock,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    },
                    trailingIcon = {
                        IconButton(
                            onClick = { showToken = !showToken },
                            modifier = Modifier.testTag("btn_toggle_token_visibility")
                        ) {
                            Icon(
                                imageVector = if (showToken) {
                                    Icons.Rounded.VisibilityOff
                                } else {
                                    Icons.Rounded.Visibility
                                },
                                contentDescription = if (showToken) "إخفاء الرمز" else "إظهار الرمز"
                            )
                        }
                    },
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = ext.cardBorder
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("input_token")
                )

                // Paste & Clear Token Helpers
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = {
                            val pasted = clipboard.getText()?.text?.trim().orEmpty()
                            if (pasted.isNotEmpty()) {
                                token = pasted
                            }
                        },
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                        modifier = Modifier.testTag("btn_paste_token")
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.ContentPaste,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("لصق من الحافظة", style = MaterialTheme.typography.labelMedium)
                    }

                    if (token.isNotEmpty()) {
                        TextButton(
                            onClick = {
                                token = ""
                                controller.saveSettings(currentConfig().copy(token = ""))
                            },
                            modifier = Modifier.testTag("btn_clear_token")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.DeleteOutline,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "مسح الرمز",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))

                // Save & Test Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = { controller.saveSettings(currentConfig()) },
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("btn_save_settings")
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Save,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("حفظ الإعدادات", style = MaterialTheme.typography.labelMedium)
                    }

                    Button(
                        onClick = { controller.testAndSaveConnection(currentConfig()) },
                        enabled = !controller.isTestingConnection,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("btn_test_connection")
                    ) {
                        if (controller.isTestingConnection) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Rounded.WifiTethering,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("اختبار الاتصال", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }

        // Concise 3-Step Arabic Guide for Fine-Grained PAT
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, ext.cardBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "طريقة إنشاء رمز GitHub مقيّد بمستودع zme فقط",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface
                )

                GuideStep(
                    stepNumber = "1",
                    text = "افتح GitHub ثم Settings ثم Developer settings ثم Personal access tokens ثم Fine-grained tokens واضغط Generate new token."
                )
                GuideStep(
                    stepNumber = "2",
                    text = "من قسم Repository access اختر Only select repositories وحدد مستودع zme فقط دون بقية المستودعات."
                )
                GuideStep(
                    stepNumber = "3",
                    text = "من قسم Repository permissions امنح صلاحية Contents بمستوى Read and write ثم انسخ الرمز والصقه أعلاه واضغط «اختبار الاتصال»."
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
private fun LtrSettingField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    tag: String
) {
    val ext = LocalZmeColors.current
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyMedium.copy(
            textDirection = TextDirection.Ltr
        ),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = ext.cardBorder
        ),
        modifier = Modifier
            .fillMaxWidth()
            .testTag(tag)
    )
}

@Composable
private fun GuideStep(
    stepNumber: String,
    text: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top
    ) {
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(26.dp)
        ) {
            Column(
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = stepNumber,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )
    }
}
