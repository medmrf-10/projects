package io.medmrf.zmenotes.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import io.medmrf.zmenotes.model.GitHubConfig
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureSettingsStore(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val securePrefs = context.applicationContext
        .getSharedPreferences(SECURE_PREFS_NAME, Context.MODE_PRIVATE)

    fun loadConfig(): GitHubConfig {
        return GitHubConfig(
            owner = prefs.getString(KEY_OWNER, GitHubConfig.DEFAULT_OWNER) ?: GitHubConfig.DEFAULT_OWNER,
            repo = prefs.getString(KEY_REPO, GitHubConfig.DEFAULT_REPO) ?: GitHubConfig.DEFAULT_REPO,
            branch = prefs.getString(KEY_BRANCH, GitHubConfig.DEFAULT_BRANCH) ?: GitHubConfig.DEFAULT_BRANCH,
            filePath = prefs.getString(KEY_FILE_PATH, GitHubConfig.DEFAULT_FILE_PATH)
                ?: GitHubConfig.DEFAULT_FILE_PATH,
            token = decryptToken()
        )
    }

    fun saveConfig(config: GitHubConfig) {
        val clean = config.normalized()
        prefs.edit()
            .putString(KEY_OWNER, clean.owner.ifEmpty { GitHubConfig.DEFAULT_OWNER })
            .putString(KEY_REPO, clean.repo.ifEmpty { GitHubConfig.DEFAULT_REPO })
            .putString(KEY_BRANCH, clean.branch.ifEmpty { GitHubConfig.DEFAULT_BRANCH })
            .putString(KEY_FILE_PATH, clean.filePath.ifEmpty { GitHubConfig.DEFAULT_FILE_PATH })
            .apply()

        if (clean.token.isEmpty()) {
            securePrefs.edit().remove(KEY_ENCRYPTED_TOKEN).apply()
        } else {
            encryptAndSaveToken(clean.token)
        }
    }

    fun isDarkTheme(): Boolean = prefs.getBoolean(KEY_DARK_THEME, true)

    fun setDarkTheme(dark: Boolean) {
        prefs.edit().putBoolean(KEY_DARK_THEME, dark).apply()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        val keyGen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build()
        keyGen.init(spec)
        return keyGen.generateKey()
    }

    private fun encryptAndSaveToken(plaintext: String) {
        val key = getOrCreateKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))
        val encoded = "${Base64.encodeToString(iv, Base64.NO_WRAP)}:${Base64.encodeToString(ciphertext, Base64.NO_WRAP)}"
        securePrefs.edit().putString(KEY_ENCRYPTED_TOKEN, encoded).apply()
    }

    private fun decryptToken(): String {
        val raw = securePrefs.getString(KEY_ENCRYPTED_TOKEN, null) ?: return ""
        val parts = raw.split(':')
        if (parts.size != 2) return ""
        return try {
            val iv = Base64.decode(parts[0], Base64.NO_WRAP)
            val ciphertext = Base64.decode(parts[1], Base64.NO_WRAP)
            val key = getOrCreateKey()
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, iv))
            String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8)
        } catch (_: Exception) {
            ""
        }
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "io.medmrf.zmenotes.sync_key_aes256gcm"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_BITS = 128

        private const val PREFS_NAME = "zme_notes_prefs"
        private const val SECURE_PREFS_NAME = "zme_notes_secure_prefs"

        private const val KEY_OWNER = "gh_owner"
        private const val KEY_REPO = "gh_repo"
        private const val KEY_BRANCH = "gh_branch"
        private const val KEY_FILE_PATH = "gh_file_path"
        private const val KEY_DARK_THEME = "dark_theme"
        private const val KEY_ENCRYPTED_TOKEN = "gh_pat_gcm"
    }
}
