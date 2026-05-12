package com.ayaan.dealora.ui.presentation.syncapps.viewmodels

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.BuildConfig
import com.ayaan.dealora.data.api.models.GmailExtractedCoupon
import com.ayaan.dealora.data.api.models.LinkedEmail
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.repository.ConnectEmailRepository
import com.ayaan.dealora.data.repository.GmailSyncRepository
import com.ayaan.dealora.data.repository.GmailSyncResult
import com.ayaan.dealora.data.repository.LinkedEmailsResult
import com.ayaan.dealora.data.repository.RemoveEmailResult
import com.ayaan.dealora.data.repository.TermsRepository
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import com.squareup.moshi.Moshi
import javax.inject.Inject

// Represents the state of the entire Gmail Sync feature screen
sealed class GmailSyncState {
    data object Idle : GmailSyncState()
    data object SigningIn : GmailSyncState()
    data object Syncing : GmailSyncState()
    data class Success(
        val extractedCount: Int,
        val skippedCount: Int,
        val coupons: List<GmailExtractedCoupon>
    ) : GmailSyncState()
    data class Error(val message: String) : GmailSyncState()
}

@HiltViewModel
class GmailSyncViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gmailSyncRepository: GmailSyncRepository,
    private val connectEmailRepository: ConnectEmailRepository,
    val moshi: Moshi,
    private val termsRepository: TermsRepository
) : ViewModel() {

    companion object {
        private const val TAG = "GmailSyncViewModel"
    }

    private val _isSignedIn = MutableStateFlow(false)
    val isSignedIn: StateFlow<Boolean> = _isSignedIn.asStateFlow()

    /** List of emails the user has linked via the connect-email flow */
    private val _linkedEmails = MutableStateFlow<List<LinkedEmail>>(emptyList())
    val linkedEmails: StateFlow<List<LinkedEmail>> = _linkedEmails.asStateFlow()

    /** Whether the current user has accepted the current Terms & Conditions version */
    private val _termsAccepted = MutableStateFlow(false)
    val termsAccepted: StateFlow<Boolean> = _termsAccepted.asStateFlow()

    /** The terms version string returned by the server (e.g. "1.0") */
    private val _termsVersion = MutableStateFlow("1.0")
    val termsVersion: StateFlow<String> = _termsVersion.asStateFlow()

    /**
     * Per-email sync state map: each key is an email address, value is the
     * current GmailSyncState for that card.  Missing key → Idle.
     */
    private val _perEmailState = MutableStateFlow<Map<String, GmailSyncState>>(emptyMap())
    val perEmailState: StateFlow<Map<String, GmailSyncState>> = _perEmailState.asStateFlow()

    /** True while a remove-email backend call is in flight */
    private val _isRemovingEmail = MutableStateFlow(false)
    val isRemovingEmail: StateFlow<Boolean> = _isRemovingEmail.asStateFlow()

    /** True while we are fetching the linked emails list from the backend */
    private val _isLoadingEmails = MutableStateFlow(false)
    val isLoadingEmails: StateFlow<Boolean> = _isLoadingEmails.asStateFlow()

    // GoogleSignInClient is created once and reused
    val googleSignInClient: GoogleSignInClient by lazy {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestServerAuthCode(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .requestScopes(Scope("https://www.googleapis.com/auth/gmail.readonly"))
            .build()
        GoogleSignIn.getClient(context, gso)
    }

    init {
        // Check if user already granted Gmail access in a previous session
        val lastAccount = GoogleSignIn.getLastSignedInAccount(context)
        val hasGmailScope = lastAccount?.grantedScopes?.any {
            it.scopeUri == "https://www.googleapis.com/auth/gmail.readonly"
        } ?: false
        _isSignedIn.value = hasGmailScope
        Log.d(TAG, "Init: isSignedIn=$hasGmailScope")

        // Fetch linked emails immediately on screen open
        loadLinkedEmails()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun setEmailState(email: String, state: GmailSyncState) {
        _perEmailState.update { it + (email to state) }
    }

    /** Returns the current state for an email, defaulting to Idle. */
    fun stateFor(email: String): GmailSyncState =
        _perEmailState.value[email] ?: GmailSyncState.Idle

    // ── Load linked emails ────────────────────────────────────────────────────

    /**
     * Fetches the list of linked Gmail accounts from the backend.
     * Also updates [termsAccepted] from the response.
     */
    fun loadLinkedEmails() {
        val userId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        viewModelScope.launch {
            _isLoadingEmails.value = true
            when (val result = connectEmailRepository.getLinkedEmails(userId)) {
                is LinkedEmailsResult.Success -> {
                    _linkedEmails.value = result.emails
                    _termsAccepted.value = result.termsAccepted
                    result.termsVersion?.let { _termsVersion.value = it }
                    Log.d(TAG, "Loaded ${result.emails.size} linked email(s), termsAccepted=${result.termsAccepted}")
                }
                is LinkedEmailsResult.Error -> {
                    Log.e(TAG, "Failed to load linked emails: ${result.message}")
                }
            }
            _isLoadingEmails.value = false
        }
    }

    /**
     * Records terms acceptance for the current user.
     * After success, reloads linked emails so [termsAccepted] flips to true.
     */
    fun acceptTerms(onSuccess: () -> Unit, onError: (String) -> Unit) {
        val userId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        viewModelScope.launch {
            val result = termsRepository.acceptTerms(userId, _termsVersion.value)
            when (result) {
                is com.ayaan.dealora.data.repository.TermsAcceptResult.Success -> {
                    Log.d(TAG, "Terms accepted, reloading emails")
                    loadLinkedEmails()
                    onSuccess()
                }
                is com.ayaan.dealora.data.repository.TermsAcceptResult.Error -> {
                    Log.e(TAG, "Failed to accept terms: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    // ── Per-card scanning ────────────────────────────────────────────────────

    /**
     * Called when the user taps "Scan for Coupons" on a specific email card.
     * Uses the backend's stored refresh token for that email — no local sign-in needed.
     */
    fun syncForEmail(email: String) {
        viewModelScope.launch {
            Log.d(TAG, "Syncing for email: $email (using backend refresh token)")
            setEmailState(email, GmailSyncState.Syncing)
            val userId = FirebaseAuth.getInstance().currentUser?.uid ?: "anonymous"
            when (val result = gmailSyncRepository.syncGmail("", userId, email)) {
                is GmailSyncResult.Success -> {
                    setEmailState(
                        email,
                        GmailSyncState.Success(
                            extractedCount = result.extractedCount,
                            skippedCount = result.skippedCount,
                            coupons = result.coupons
                        )
                    )
                }
                is GmailSyncResult.Error -> {
                    setEmailState(email, GmailSyncState.Error(result.message))
                }
            }
        }
    }

    /**
     * Resets a single email card back to Idle (e.g. after an error the user dismisses).
     */
    fun resetStateForEmail(email: String) {
        setEmailState(email, GmailSyncState.Idle)
    }

    /**
     * Serializes a [GmailExtractedCoupon] (which is already saved in the DB) as a [PrivateCoupon]
     * JSON string. Pass this as `couponData` when navigating to CouponDetailsScreen so the details
     * screen can display the coupon immediately without a brand-filtered API lookup.
     */
    fun couponDataJson(coupon: GmailExtractedCoupon): String? {
        if (coupon.id == null) return null
        return try {
            val privateCoupon = PrivateCoupon(
                id           = coupon.id,
                brandName    = coupon.brandName ?: "Unknown",
                couponTitle  = coupon.couponName ?: coupon.brandName,
                couponCode   = coupon.couponCode,
                description  = coupon.description,
                discountType = coupon.discountType,
                discountValue = coupon.discountValue,
                expiryDate   = coupon.expireBy,
                couponLink   = coupon.websiteLink,
                couponVisitingLink = coupon.couponVisitingLink,
                couponType   = "gmail"
            )
            moshi.adapter(PrivateCoupon::class.java).toJson(privateCoupon)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to serialize coupon to JSON", e)
            null
        }
    }

    // ── Legacy sign-in flow (kept for handleSignInResult compat) ──────────────

    /**
     * Called after the Google Sign-In Activity returns its result.
     * NOTE: This path is no longer the primary scan path; it exists in case
     * we ever need to re-authenticate for a specific account from the device.
     */
    fun handleSignInResult(account: GoogleSignInAccount?, errorCode: Int = -1) {
        if (account == null) {
            val reason = when (errorCode) {
                10    -> "DEVELOPER_ERROR (code 10): SHA-1 fingerprint or Web Client ID mismatch. Check Cloud Console."
                12500 -> "Sign-in cancelled by user."
                12501 -> "Sign-in cancelled (no account selected)."
                7     -> "Network error. Check your internet connection."
                else  -> "Sign-in failed (code $errorCode). Check Logcat for details."
            }
            Log.e(TAG, "handleSignInResult failed: $reason")
            return
        }
        _isSignedIn.value = true
        Log.d(TAG, "Sign-in successful for: ${account.email}")
    }

    fun signOut() {
        viewModelScope.launch {
            googleSignInClient.signOut().await()
            _isSignedIn.value = false
            Log.d(TAG, "Signed out from Gmail")
        }
    }

    // ── Remove linked email ───────────────────────────────────────────────────

    /** One-shot events emitted when a remove-email call completes. */
    private val _removeEmailEvent = MutableSharedFlow<RemoveEmailResult>(extraBufferCapacity = 1)
    val removeEmailEvent: SharedFlow<RemoveEmailResult> = _removeEmailEvent.asSharedFlow()

    /**
     * Removes [email] from the user's connected list on the backend.
     * On success: removes it from the per-email state map and refreshes the list.
     */
    fun removeLinkedEmail(email: String) {
        val userId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        viewModelScope.launch {
            _isRemovingEmail.value = true
            when (val result = connectEmailRepository.removeEmail(userId, email)) {
                is RemoveEmailResult.Success -> {
                    Log.d(TAG, "Removed linked email: $email")
                    // Remove this email's state from the map
                    _perEmailState.update { it - email }
                    loadLinkedEmails()
                    _removeEmailEvent.emit(result)
                }
                is RemoveEmailResult.Error -> {
                    Log.e(TAG, "Failed to remove email: ${result.message}")
                    _removeEmailEvent.emit(result)
                }
            }
            _isRemovingEmail.value = false
        }
    }
}
