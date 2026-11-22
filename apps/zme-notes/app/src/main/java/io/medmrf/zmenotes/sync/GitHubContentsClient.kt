package io.medmrf.zmenotes.sync

import io.medmrf.zmenotes.model.GitHubConfig
import io.medmrf.zmenotes.model.NoteRecord
import java.io.IOException
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Base64
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

data class HttpRequest(
    val method: String,
    val url: String,
    val headers: Map<String, String>,
    val body: String? = null
)

data class HttpResponse(
    val code: Int,
    val body: String
)

interface HttpTransport {
    @Throws(IOException::class)
    fun execute(request: HttpRequest): HttpResponse
}

class OkHttpTransport(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()
) : HttpTransport {

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    override fun execute(request: HttpRequest): HttpResponse {
        val builder = Request.Builder().url(request.url)
        request.headers.forEach { (k, v) -> builder.addHeader(k, v) }
        when (request.method.uppercase()) {
            "GET" -> builder.get()
            "PUT" -> builder.put((request.body ?: "").toRequestBody(jsonMediaType))
            else -> throw IllegalArgumentException("Unsupported method: ${request.method}")
        }
        client.newCall(builder.build()).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            return HttpResponse(code = response.code, body = responseBody)
        }
    }
}

sealed class ConnectionTestResult {
    data class Success(val message: String) : ConnectionTestResult()
    data class Warning(val message: String) : ConnectionTestResult()
    data class Failure(val message: String) : ConnectionTestResult()
}

sealed class SyncResult {
    data class Success(val commitSha: String?, val sequenceNumber: Int) : SyncResult()
    data class Failure(
        val message: String,
        val isNetworkError: Boolean = false,
        val isAuthError: Boolean = false
    ) : SyncResult()
}

interface NoteSyncGateway {
    fun testConnection(config: GitHubConfig): ConnectionTestResult
    fun pushNote(config: GitHubConfig, note: NoteRecord): SyncResult
}

class GitHubContentsClient(
    private val transport: HttpTransport = OkHttpTransport(),
    private val apiBaseUrl: String = "https://api.github.com"
) : NoteSyncGateway {

    private val json = Json { ignoreUnknownKeys = true }

    override fun testConnection(config: GitHubConfig): ConnectionTestResult {
        val cfg = config.normalized()
        if (cfg.owner.isEmpty() || cfg.repo.isEmpty()) {
            return ConnectionTestResult.Failure("يرجى إدخال اسم المالك واسم المستودع أولاً")
        }
        if (cfg.token.isEmpty()) {
            return ConnectionTestResult.Failure("يرجى إدخال رمز GitHub أولاً")
        }

        val url = "${apiBaseUrl.trimEnd('/')}/repos/${encodeSegment(cfg.owner)}/${encodeSegment(cfg.repo)}"
        val response = try {
            transport.execute(
                HttpRequest(
                    method = "GET",
                    url = url,
                    headers = buildHeaders(cfg.token)
                )
            )
        } catch (_: IOException) {
            return ConnectionTestResult.Failure("تعذر الاتصال بالإنترنت — تحقق من الشبكة وحاول مجدداً")
        }

        return when (response.code) {
            200 -> {
                val pushAllowed = parsePushPermission(response.body)
                if (pushAllowed == false) {
                    ConnectionTestResult.Warning(
                        "تم الوصول للمستودع لكن الرمز يفتقر لصلاحية الكتابة (Contents: Read and write)"
                    )
                } else {
                    ConnectionTestResult.Success(
                        "الاتصال ناجح ✓ المستودع ${cfg.owner}/${cfg.repo} جاهز للمزامنة"
                    )
                }
            }
            401 -> ConnectionTestResult.Failure("فشل المصادقة (401): رمز GitHub غير صالح أو منتهي الصلاحية")
            403 -> ConnectionTestResult.Failure("صلاحيات غير كافية (403): تأكد من تفعيل صلاحية Contents قراءة وكتابة")
            404 -> ConnectionTestResult.Failure("المستودع غير موجود أو الرمز لا يملك صلاحية الوصول إليه (404)")
            else -> ConnectionTestResult.Failure("فشل الاتصال برمز حالة (${response.code})")
        }
    }

    override fun pushNote(config: GitHubConfig, note: NoteRecord): SyncResult {
        val cfg = config.normalized()
        if (!cfg.isConfigured()) {
            return SyncResult.Failure(
                message = "إعدادات GitHub غير مكتملة",
                isAuthError = true
            )
        }

        val encodedPath = encodeRepoPath(cfg.filePath)
        val encodedBranch = encodeSegment(cfg.branch)
        val contentsBase =
            "${apiBaseUrl.trimEnd('/')}/repos/${encodeSegment(cfg.owner)}/${encodeSegment(cfg.repo)}/contents/$encodedPath"
        val getUrl = "$contentsBase?ref=$encodedBranch"
        val headers = buildHeaders(cfg.token)

        for (attempt in 0..MAX_CONFLICT_RETRIES) {
            val getResp = try {
                transport.execute(HttpRequest(method = "GET", url = getUrl, headers = headers))
            } catch (_: IOException) {
                return SyncResult.Failure(
                    message = "تعذر الاتصال بالخادم — محفوظ محلياً",
                    isNetworkError = true
                )
            }

            val existingContent: String?
            val existingSha: String?

            when (getResp.code) {
                200 -> {
                    val parsed = parseContentsResponse(getResp.body)
                        ?: return SyncResult.Failure("تعذر قراءة استجابة الملف من GitHub")
                    existingSha = parsed.first
                    existingContent = parsed.second
                }
                404 -> {
                    existingSha = null
                    existingContent = null
                }
                401 -> return SyncResult.Failure(
                    message = "فشل المصادقة (401): تحقق من رمز GitHub",
                    isAuthError = true
                )
                403 -> return SyncResult.Failure(
                    message = "صلاحيات غير كافية (403): يتطلب صلاحية Contents قراءة وكتابة",
                    isAuthError = true
                )
                else -> return SyncResult.Failure(
                    message = "تعذر قراءة الملف من GitHub (${getResp.code})"
                )
            }

            val appendResult = PsychoInboxFormatter.appendNote(
                existingContent = existingContent,
                dateYyyyMmDd = note.formattedDate,
                timeHhMm = note.formattedTime,
                category = note.category,
                intensity = note.intensity,
                rawNote = note.content
            )

            val encodedContent = Base64.getEncoder()
                .encodeToString(appendResult.updatedDocument.toByteArray(StandardCharsets.UTF_8))

            val commitMessage =
                "Add psycho note from Android app (${note.formattedDate} ${note.formattedTime})"

            val putPayload = buildJsonObject {
                put("message", commitMessage)
                put("content", encodedContent)
                put("branch", cfg.branch)
                if (existingSha != null) {
                    put("sha", existingSha)
                }
            }.toString()

            val putResp = try {
                transport.execute(
                    HttpRequest(
                        method = "PUT",
                        url = contentsBase,
                        headers = headers,
                        body = putPayload
                    )
                )
            } catch (_: IOException) {
                return SyncResult.Failure(
                    message = "انقطع الاتصال أثناء الإرسال — محفوظ محلياً",
                    isNetworkError = true
                )
            }

            when (putResp.code) {
                200, 201 -> {
                    val commitSha = parseCommitSha(putResp.body)
                    return SyncResult.Success(
                        commitSha = commitSha,
                        sequenceNumber = appendResult.sequenceNumber
                    )
                }
                409 -> {
                    if (attempt < MAX_CONFLICT_RETRIES) {
                        continue
                    }
                    return SyncResult.Failure(
                        message = "تعارض متكرر أثناء التحديث (409) — أعد المحاولة لاحقاً"
                    )
                }
                401 -> return SyncResult.Failure(
                    message = "فشل المصادقة (401): تحقق من رمز GitHub",
                    isAuthError = true
                )
                403 -> return SyncResult.Failure(
                    message = "صلاحيات غير كافية (403): فعّل صلاحية الكتابة لـ Contents",
                    isAuthError = true
                )
                422 -> return SyncResult.Failure(
                    message = "رفض GitHub التحديث (422): تحقق من اسم الفرع ومسار الملف"
                )
                else -> return SyncResult.Failure(
                    message = "فشل حفظ الملاحظة في GitHub (${putResp.code})"
                )
            }
        }

        return SyncResult.Failure("تعارض متكرر أثناء التحديث (409) — أعد المحاولة لاحقاً")
    }

    private fun buildHeaders(token: String): Map<String, String> = mapOf(
        "Authorization" to "Bearer $token",
        "Accept" to "application/vnd.github+json",
        "X-GitHub-Api-Version" to "2022-11-28",
        "User-Agent" to "ZmeNotes-Android/1.0.0"
    )

    private fun encodeSegment(segment: String): String =
        URLEncoder.encode(segment, StandardCharsets.UTF_8.name()).replace("+", "%20")

    private fun encodeRepoPath(path: String): String =
        path.split('/')
            .filter { it.isNotEmpty() }
            .joinToString("/") { encodeSegment(it) }

    private fun parsePushPermission(body: String): Boolean? {
        return try {
            val root = json.parseToJsonElement(body).jsonObject
            val perms = root["permissions"] as? JsonObject ?: return null
            perms["push"]?.jsonPrimitive?.booleanOrNull
        } catch (_: Exception) {
            null
        }
    }

    private fun parseContentsResponse(body: String): Pair<String, String>? {
        return try {
            val root = json.parseToJsonElement(body).jsonObject
            val sha = root["sha"]?.jsonPrimitive?.contentOrNull ?: return null
            val encoded = root["content"]?.jsonPrimitive?.contentOrNull ?: ""
            val cleaned = encoded.replace("\n", "").replace("\r", "").trim()
            val decoded = if (cleaned.isEmpty()) {
                ""
            } else {
                String(Base64.getDecoder().decode(cleaned), StandardCharsets.UTF_8)
            }
            sha to decoded
        } catch (_: Exception) {
            null
        }
    }

    private fun parseCommitSha(body: String): String? {
        return try {
            val root = json.parseToJsonElement(body).jsonObject
            val commit = root["commit"] as? JsonObject ?: return null
            commit["sha"]?.jsonPrimitive?.contentOrNull
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        const val MAX_CONFLICT_RETRIES = 3
    }
}
