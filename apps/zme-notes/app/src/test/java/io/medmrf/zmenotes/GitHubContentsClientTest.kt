package io.medmrf.zmenotes

import io.medmrf.zmenotes.model.GitHubConfig
import io.medmrf.zmenotes.model.NoteRecord
import io.medmrf.zmenotes.sync.ConnectionTestResult
import io.medmrf.zmenotes.sync.GitHubContentsClient
import io.medmrf.zmenotes.sync.HttpRequest
import io.medmrf.zmenotes.sync.HttpResponse
import io.medmrf.zmenotes.sync.HttpTransport
import io.medmrf.zmenotes.sync.PsychoInboxFormatter
import io.medmrf.zmenotes.sync.SyncResult
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.util.Base64
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GitHubContentsClientTest {

    private val testConfig = GitHubConfig(
        owner = "medmrf-10",
        repo = "zme",
        branch = "main",
        filePath = "ALL/health/psycho/PsychoInbox.md",
        token = "test_fake_token_only_for_unit_test"
    )

    private val sampleNote = NoteRecord(
        id = 1L,
        content = "ملاحظة اختبارية من الوحدة",
        category = "تفكير وتركيز",
        intensity = 3,
        createdAtEpochMs = 1_763_793_600_000L,
        formattedDate = "2026-11-22",
        formattedTime = "08:30"
    )

    private class ScriptedTransport(
        private val handler: (HttpRequest) -> HttpResponse
    ) : HttpTransport {
        val requests = mutableListOf<HttpRequest>()
        override fun execute(request: HttpRequest): HttpResponse {
            requests.add(request)
            return handler(request)
        }
    }

    private fun encodeB64(text: String): String =
        Base64.getEncoder().encodeToString(text.toByteArray(StandardCharsets.UTF_8))

    @Test
    fun testConnectionHandlesSuccessWarningAndAuthErrors() {
        val okClient = GitHubContentsClient(
            ScriptedTransport {
                HttpResponse(200, """{"full_name":"medmrf-10/zme","permissions":{"push":true}}""")
            }
        )
        assertTrue(okClient.testConnection(testConfig) is ConnectionTestResult.Success)

        val readOnlyClient = GitHubContentsClient(
            ScriptedTransport {
                HttpResponse(200, """{"full_name":"medmrf-10/zme","permissions":{"push":false}}""")
            }
        )
        assertTrue(readOnlyClient.testConnection(testConfig) is ConnectionTestResult.Warning)

        val unauthClient = GitHubContentsClient(
            ScriptedTransport { HttpResponse(401, """{"message":"Bad credentials"}""") }
        )
        assertTrue(unauthClient.testConnection(testConfig) is ConnectionTestResult.Failure)

        val offlineClient = GitHubContentsClient(
            ScriptedTransport { throw IOException("No network") }
        )
        assertTrue(offlineClient.testConnection(testConfig) is ConnectionTestResult.Failure)
    }

    @Test
    fun pushNoteAppendsToExistingFileWithExactShaAndCommitMessage() {
        val initialEncoded = encodeB64(PsychoInboxFormatter.INITIAL_TEMPLATE)
            .chunked(60)
            .joinToString("\n") // GitHub wraps base64 lines with \n

        val transport = ScriptedTransport { req ->
            when (req.method) {
                "GET" -> HttpResponse(200, """{"sha":"sha_initial_123","content":"$initialEncoded"}""")
                "PUT" -> HttpResponse(200, """{"commit":{"sha":"commit_abc_999"}}""")
                else -> error("Unexpected method ${req.method}")
            }
        }

        val client = GitHubContentsClient(transport)
        val result = client.pushNote(testConfig, sampleNote)

        assertTrue(result is SyncResult.Success)
        val success = result as SyncResult.Success
        assertEquals("commit_abc_999", success.commitSha)
        assertEquals(1, success.sequenceNumber)

        val putReq = transport.requests.last()
        assertEquals("PUT", putReq.method)
        assertEquals(
            "https://api.github.com/repos/medmrf-10/zme/contents/ALL/health/psycho/PsychoInbox.md",
            putReq.url
        )

        val payload = Json.parseToJsonElement(putReq.body!!).jsonObject
        assertEquals("Add psycho note from Android app (2026-11-22 08:30)", payload["message"]?.jsonPrimitive?.content)
        assertEquals("main", payload["branch"]?.jsonPrimitive?.content)
        assertEquals("sha_initial_123", payload["sha"]?.jsonPrimitive?.content)

        val uploadedMarkdown = String(
            Base64.getDecoder().decode(payload["content"]!!.jsonPrimitive.content),
            StandardCharsets.UTF_8
        )
        assertTrue(uploadedMarkdown.contains("1. ملاحظة بتاريخ **2026-11-22** الساعة **08:30**:"))
        assertTrue(uploadedMarkdown.contains("\t3. النص: ملاحظة اختبارية من الوحدة"))
    }

    @Test
    fun pushNoteCreatesInitialFileWhenRemoteReturns404() {
        val transport = ScriptedTransport { req ->
            when (req.method) {
                "GET" -> HttpResponse(404, """{"message":"Not Found"}""")
                "PUT" -> HttpResponse(201, """{"commit":{"sha":"commit_created_1"}}""")
                else -> error("Unexpected method")
            }
        }

        val client = GitHubContentsClient(transport)
        val result = client.pushNote(testConfig, sampleNote)

        assertTrue(result is SyncResult.Success)
        val putPayload = Json.parseToJsonElement(transport.requests.last().body!!).jsonObject
        assertNull("sha must be omitted when creating a new file", putPayload["sha"])

        val uploadedMarkdown = String(
            Base64.getDecoder().decode(putPayload["content"]!!.jsonPrimitive.content),
            StandardCharsets.UTF_8
        )
        assertTrue(uploadedMarkdown.startsWith("# صندوق الملاحظات النفسية السريع (**PsychoInbox**)"))
        assertTrue(uploadedMarkdown.contains("1. ملاحظة بتاريخ **2026-11-22** الساعة **08:30**:"))
    }

    @Test
    fun pushNoteRetriesUpToThreeTimesOn409ConflictAndReReadsLatestSha() {
        var putCount = 0
        val secondRemoteDoc = PsychoInboxFormatter.appendNote(
            existingContent = PsychoInboxFormatter.INITIAL_TEMPLATE,
            dateYyyyMmDd = "2026-11-22",
            timeHhMm = "08:00",
            category = "ملاحظة عامة",
            intensity = null,
            rawNote = "ملاحظة سبقتنا من جهاز آخر"
        ).updatedDocument

        val transport = ScriptedTransport { req ->
            when (req.method) {
                "GET" -> {
                    val (sha, doc) = when (putCount) {
                        0 -> "sha_v1" to PsychoInboxFormatter.INITIAL_TEMPLATE
                        1 -> "sha_v2" to secondRemoteDoc
                        else -> "sha_v3" to secondRemoteDoc
                    }
                    HttpResponse(200, """{"sha":"$sha","content":"${encodeB64(doc)}"}""")
                }
                "PUT" -> {
                    putCount++
                    if (putCount <= 2) {
                        HttpResponse(409, """{"message":"sha does not match"}""")
                    } else {
                        HttpResponse(200, """{"commit":{"sha":"commit_after_retry"}}""")
                    }
                }
                else -> error("Unexpected method")
            }
        }

        val client = GitHubContentsClient(transport)
        val result = client.pushNote(testConfig, sampleNote)

        assertTrue(result is SyncResult.Success)
        val success = result as SyncResult.Success
        assertEquals("commit_after_retry", success.commitSha)
        assertEquals(2, success.sequenceNumber)
        assertEquals(3, putCount)
        val finalPutPayload = Json.parseToJsonElement(transport.requests.last().body!!).jsonObject
        assertEquals("sha_v3", finalPutPayload["sha"]?.jsonPrimitive?.content)
    }

    @Test
    fun pushNoteFailsAfterExceedingThree409Retries() {
        var putAttempts = 0
        val transport = ScriptedTransport { req ->
            when (req.method) {
                "GET" -> HttpResponse(
                    200,
                    """{"sha":"sha_$putAttempts","content":"${encodeB64(PsychoInboxFormatter.INITIAL_TEMPLATE)}"}"""
                )
                "PUT" -> {
                    putAttempts++
                    HttpResponse(409, """{"message":"conflict"}""")
                }
                else -> error("Unexpected method")
            }
        }

        val client = GitHubContentsClient(transport)
        val result = client.pushNote(testConfig, sampleNote)

        assertTrue(result is SyncResult.Failure)
        // Initial attempt + 3 retries = 4 PUT attempts
        assertEquals(4, putAttempts)
        assertFalse((result as SyncResult.Failure).isAuthError)
    }

    @Test
    fun pushNoteDoesNotRetryOnAuthFailureAndFlagsNetworkErrors() {
        var calls = 0
        val authFailClient = GitHubContentsClient(
            ScriptedTransport {
                calls++
                HttpResponse(401, """{"message":"Bad credentials"}""")
            }
        )
        val authRes = authFailClient.pushNote(testConfig, sampleNote)
        assertTrue(authRes is SyncResult.Failure && authRes.isAuthError)
        assertEquals(1, calls)

        val netFailClient = GitHubContentsClient(
            ScriptedTransport { throw IOException("Timeout") }
        )
        val netRes = netFailClient.pushNote(testConfig, sampleNote)
        assertTrue(netRes is SyncResult.Failure && netRes.isNetworkError)
    }
}
