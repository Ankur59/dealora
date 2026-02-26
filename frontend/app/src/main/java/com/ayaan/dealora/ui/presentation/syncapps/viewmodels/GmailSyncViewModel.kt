package com.ayaan.dealora.ui.presentation.syncapps.viewmodels

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.BuildConfig
import com.ayaan.dealora.data.api.models.GmailExtractedCoupon
import com.ayaan.dealora.data.api.models.LinkedEmail
import com.ayaan.dealora.data.repository.ConnectEmailRepository
import com.ayaan.dealora.data.repository.GmailSyncRepository
import com.ayaan.dealora.data.repository.GmailSyncResult
import com.ayaan.dealora.data.repository.LinkedEmailsResult
import com.ayaan.dealora.data.repository.RemoveEmailResult
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
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
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
    private val connectEmailRepository: ConnectEmailRepository
) : ViewModel() {

    companion object {
        private const val TAG = "GmailSyncViewModel"
    }

    private val _state = MutableStateFlow<GmailSyncState>(GmailSyncState.Idle)
    val state: StateFlow<GmailSyncState> = _state.asStateFlow()

    private val _isSignedIn = MutableStateFlow(false)
    val isSignedIn: StateFlow<Boolean> = _isSignedIn.asStateFlow()

    /** List of emails the user has linked via the connect-email flow */
    private val _linkedEmails = MutableStateFlow<List<LinkedEmail>>(emptyList())
    val linkedEmails: StateFlow<List<LinkedEmail>> = _linkedEmails.asStateFlow()

    /** The email the user has selected in the dropdown — null means nothing selected yet */
    private val _selectedEmail = MutableStateFlow<String?>(null)
    val selectedEmail: StateFlow<String?> = _selectedEmail.asStateFlow()

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

    /**
     * Fetches the list of linked Gmail accounts from the backend.
     */
    fun loadLinkedEmails() {
        val userId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        viewModelScope.launch {
            _isLoadingEmails.value = true
            when (val result = connectEmailRepository.getLinkedEmails(userId)) {
                is LinkedEmailsResult.Success -> {
                    _linkedEmails.value = result.emails
                    Log.d(TAG, "Loaded ${result.emails.size} linked email(s)")
                }
                is LinkedEmailsResult.Error -> {
                    Log.e(TAG, "Failed to load linked emails: ${result.message}")
                }
            }
            _isLoadingEmails.value = false
        }
    }

    /**
     * Called when the user picks an email from the dropdown.
     */
    fun selectEmail(email: String) {
        // Reset sync state whenever a different email is picked so the
        // results area returns to the initial "Scan for Coupons" view.
        if (_selectedEmail.value != email) {
            _state.value = GmailSyncState.Idle
        }
        _selectedEmail.value = email
    }

    /**
     * Called after the Google Sign-In Activity returns its result.
     */
    fun handleSignInResult(account: GoogleSignInAccount?, errorCode: Int = -1) {
        if (account == null) {
            val reason = when (errorCode) {
                10   -> "DEVELOPER_ERROR (code 10): SHA-1 fingerprint or Web Client ID mismatch. Check Cloud Console."
                12500 -> "Sign-in cancelled by user."
                12501 -> "Sign-in cancelled (no account selected)."
                7    -> "Network error. Check your internet connection."
                else -> "Sign-in failed (code $errorCode). Check Logcat for details."
            }
            Log.e(TAG, "handleSignInResult failed: $reason")
            _state.value = GmailSyncState.Error(reason)
            return
        }
        _isSignedIn.value = true
        Log.d(TAG, "Sign-in successful for: ${account.email}")
        syncEmails(account)
    }

    /**
     * Called when the user is already signed in and taps "Scan for Coupons" again.
     */
    fun syncWithExistingAccount() {
        viewModelScope.launch {
            try {
                _state.value = GmailSyncState.Syncing
                // silently re-authenticate to get fresh tokens
                val account = googleSignInClient.silentSignIn().await()
                syncEmails(account)
            } catch (e: ApiException) {
                Log.e(TAG, "Silent sign-in failed (code ${e.statusCode}), need explicit sign-in")
                _isSignedIn.value = false
                _state.value = GmailSyncState.Error("Session expired. Please sign in again.")
            } catch (e: Exception) {
                Log.e(TAG, "Sync error", e)
                _state.value = GmailSyncState.Error(e.message ?: "Unknown error")
            }
        }
    }

    private fun syncEmails(account: GoogleSignInAccount) {
        viewModelScope.launch {
            _state.value = GmailSyncState.Syncing

            // GoogleAuthUtil.getToken() is blocking — must run on IO dispatcher.
            // It returns a real OAuth Bearer access token for the requested scope.
            val accessToken = try {
                withContext(Dispatchers.IO) {
                    GoogleAuthUtil.getToken(
                        context,
                        account.account!!,
                        "oauth2:https://www.googleapis.com/auth/gmail.readonly"
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get Gmail access token", e)
                _state.value = GmailSyncState.Error(
                    "Failed to get Gmail access token: ${e.message}"
                )
                return@launch
            }

            Log.d(TAG, "Access token retrieved successfully (${accessToken.take(10)}...)")
            val userId = FirebaseAuth.getInstance().currentUser?.uid ?: "anonymous"

            when (val result = gmailSyncRepository.syncGmail(accessToken, userId, selectedEmail = _selectedEmail.value)) {
                is GmailSyncResult.Success -> {
                    _state.value = GmailSyncState.Success(
                        extractedCount = result.extractedCount,
                        skippedCount = result.skippedCount,
                        coupons = result.coupons
                    )
                }
                is GmailSyncResult.Error -> {
                    _state.value = GmailSyncState.Error(result.message)
                }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            googleSignInClient.signOut().await()
            _isSignedIn.value = false
            _state.value = GmailSyncState.Idle
            Log.d(TAG, "Signed out from Gmail")
        }
    }

    fun resetState() {
        _state.value = GmailSyncState.Idle
    }

    // ── Remove linked email ───────────────────────────────────────────────────

    /** One-shot events emitted when a remove-email call completes. */
    private val _removeEmailEvent = MutableSharedFlow<RemoveEmailResult>(extraBufferCapacity = 1)
    val removeEmailEvent: SharedFlow<RemoveEmailResult> = _removeEmailEvent.asSharedFlow()

    /**
     * Removes [email] from the user's connected list on the backend.
     * On success: clears selection, resets sync state, refreshes the dropdown.
     */
    fun removeLinkedEmail(email: String) {
        val userId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        viewModelScope.launch {
            _isRemovingEmail.value = true
            when (val result = connectEmailRepository.removeEmail(userId, email)) {
                is RemoveEmailResult.Success -> {
                    Log.d(TAG, "Removed linked email: $email")
                    _selectedEmail.value = null           // clear picker selection
                    _state.value = GmailSyncState.Idle   // reset scan area
                    loadLinkedEmails()                     // refresh dropdown
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
