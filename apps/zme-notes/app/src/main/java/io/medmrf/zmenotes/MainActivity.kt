package io.medmrf.zmenotes

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Bundle
import android.speech.RecognizerIntent
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.EditNote
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.LightMode
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import io.medmrf.zmenotes.data.NoteQueueManager
import io.medmrf.zmenotes.data.SecureSettingsStore
import io.medmrf.zmenotes.data.SqliteNoteStore
import io.medmrf.zmenotes.sync.GitHubContentsClient
import io.medmrf.zmenotes.ui.AppTab
import io.medmrf.zmenotes.ui.BannerTone
import io.medmrf.zmenotes.ui.ZmeAppController
import io.medmrf.zmenotes.ui.screens.ComposeScreen
import io.medmrf.zmenotes.ui.screens.HistoryScreen
import io.medmrf.zmenotes.ui.screens.SettingsScreen
import io.medmrf.zmenotes.ui.theme.LocalZmeColors
import io.medmrf.zmenotes.ui.theme.ZmeNotesTheme
import java.util.Locale

class MainActivity : ComponentActivity() {

    private lateinit var controller: ZmeAppController
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private val speechLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val matches = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val best = matches?.firstOrNull()?.trim().orEmpty()
            if (best.isNotEmpty()) {
                controller.appendDictatedText(best)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.decorView.layoutDirection = View.LAYOUT_DIRECTION_RTL

        val settingsStore = SecureSettingsStore(this)
        val noteStore = SqliteNoteStore(this)
        val syncClient = GitHubContentsClient()
        val queueManager = NoteQueueManager(
            store = noteStore,
            syncGateway = syncClient
        )

        controller = ZmeAppController(
            settingsStore = settingsStore,
            queueManager = queueManager,
            syncGateway = syncClient,
            scope = lifecycleScope
        )

        connectivityManager = getSystemService(ConnectivityManager::class.java)

        setContent {
            ZmeNotesTheme(darkTheme = controller.darkTheme) {
                val bgColor = MaterialTheme.colorScheme.background
                val isDark = controller.darkTheme
                SideEffect {
                    window.statusBarColor = bgColor.toArgb()
                    window.navigationBarColor = bgColor.toArgb()
                    val insetsController = WindowInsetsControllerCompat(window, window.decorView)
                    insetsController.isAppearanceLightStatusBars = !isDark
                    insetsController.isAppearanceLightNavigationBars = !isDark
                }

                ZmeNotesRoot(
                    controller = controller,
                    onVoiceDictationClick = ::launchArabicSpeechRecognizer
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        registerConnectivityListener()
    }

    override fun onResume() {
        super.onResume()
        controller.refreshNotes()
        if (controller.config.isConfigured()) {
            controller.syncAllPending(silent = true)
        }
    }

    override fun onStop() {
        super.onStop()
        unregisterConnectivityListener()
    }

    private fun registerConnectivityListener() {
        val cm = connectivityManager ?: return
        if (networkCallback != null) return
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    if (controller.config.isConfigured() && controller.pendingCount > 0) {
                        controller.syncAllPending(silent = true)
                    }
                }
            }
        }
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        try {
            cm.registerNetworkCallback(request, callback)
            networkCallback = callback
        } catch (_: Exception) {
            // Gracefully ignore if network callback registration fails on restricted devices
        }
    }

    private fun unregisterConnectivityListener() {
        val cm = connectivityManager ?: return
        val cb = networkCallback ?: return
        try {
            cm.unregisterNetworkCallback(cb)
        } catch (_: Exception) {
            // Ignore already-unregistered callback
        } finally {
            networkCallback = null
        }
    }

    private fun launchArabicSpeechRecognizer() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA")
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar-SA")
            putExtra(
                RecognizerIntent.EXTRA_SUPPORTED_LANGUAGES,
                arrayListOf("ar-SA", "ar-DZ", "ar")
            )
            putExtra(RecognizerIntent.EXTRA_PROMPT, "تحدث لتدوين ملاحظتك الآن...")
        }

        try {
            if (intent.resolveActivity(packageManager) != null) {
                speechLauncher.launch(intent)
            } else {
                controller.showTransientMessage(
                    "الإملاء الصوتي غير متوفر على هذا الجهاز",
                    BannerTone.INFO
                )
            }
        } catch (_: ActivityNotFoundException) {
            controller.showTransientMessage(
                "الإملاء الصوتي غير متوفر على هذا الجهاز",
                BannerTone.INFO
            )
        } catch (_: Exception) {
            controller.showTransientMessage(
                "تعذر تشغيل الإملاء الصوتي — يمكنك الكتابة مباشرة",
                BannerTone.INFO
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
@Composable
private fun ZmeNotesRoot(
    controller: ZmeAppController,
    onVoiceDictationClick: () -> Unit
) {
    val ext = LocalZmeColors.current

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .semantics { testTagsAsResourceId = true },
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "بوح",
                            style = MaterialTheme.typography.headlineSmall,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        if (controller.pendingCount > 0) {
                            Surface(
                                shape = RoundedCornerShape(999.dp),
                                color = ext.pendingBg,
                                onClick = {
                                    controller.selectedTab = AppTab.HISTORY
                                }
                            ) {
                                Text(
                                    text = String.format(
                                        Locale.US,
                                        "معلّق: %d",
                                        controller.pendingCount
                                    ),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ext.pendingFg,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                },
                actions = {
                    IconButton(
                        onClick = controller::toggleTheme,
                        modifier = Modifier.testTag("btn_theme_toggle")
                    ) {
                        Icon(
                            imageVector = if (controller.darkTheme) {
                                Icons.Rounded.LightMode
                            } else {
                                Icons.Rounded.DarkMode
                            },
                            contentDescription = if (controller.darkTheme) {
                                "التبديل إلى الوضع الفاتح"
                            } else {
                                "التبديل إلى الوضع الداكن"
                            },
                            tint = MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        bottomBar = {
            Box {
                HorizontalDivider(color = ext.cardBorder)
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    tonalElevation = 0.dp
                ) {
                    NavigationBarItem(
                        selected = controller.selectedTab == AppTab.COMPOSE,
                        onClick = { controller.selectedTab = AppTab.COMPOSE },
                        icon = {
                            Icon(
                                imageVector = Icons.Rounded.EditNote,
                                contentDescription = "تدوين"
                            )
                        },
                        label = { Text("تدوين") },
                        modifier = Modifier.testTag("tab_compose")
                    )
                    NavigationBarItem(
                        selected = controller.selectedTab == AppTab.HISTORY,
                        onClick = {
                            controller.selectedTab = AppTab.HISTORY
                            controller.refreshNotes()
                        },
                        icon = {
                            if (controller.pendingCount > 0) {
                                BadgedBox(
                                    badge = {
                                        Badge {
                                            Text(
                                                String.format(
                                                    Locale.US,
                                                    "%d",
                                                    controller.pendingCount
                                                )
                                            )
                                        }
                                    }
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.History,
                                        contentDescription = "السجل"
                                    )
                                }
                            } else {
                                Icon(
                                    imageVector = Icons.Rounded.History,
                                    contentDescription = "السجل"
                                )
                            }
                        },
                        label = { Text("السجل") },
                        modifier = Modifier.testTag("tab_history")
                    )
                    NavigationBarItem(
                        selected = controller.selectedTab == AppTab.SETTINGS,
                        onClick = { controller.selectedTab = AppTab.SETTINGS },
                        icon = {
                            Icon(
                                imageVector = Icons.Rounded.Settings,
                                contentDescription = "الإعدادات"
                            )
                        },
                        label = { Text("الإعدادات") },
                        modifier = Modifier.testTag("tab_settings")
                    )
                }
            }
        }
    ) { innerPadding ->
        when (controller.selectedTab) {
            AppTab.COMPOSE -> ComposeScreen(
                controller = controller,
                onVoiceDictationClick = onVoiceDictationClick,
                modifier = Modifier.padding(innerPadding)
            )
            AppTab.HISTORY -> HistoryScreen(
                controller = controller,
                modifier = Modifier.padding(innerPadding)
            )
            AppTab.SETTINGS -> SettingsScreen(
                controller = controller,
                modifier = Modifier.padding(innerPadding)
            )
        }
    }
}
