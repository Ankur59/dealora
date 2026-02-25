package com.ayaan.dealora.ui.presentation.syncapps.viewmodels

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.BuildConfig
import com.ayaan.dealora.data.repository.ConnectEmailRepository
import com.ayaan.dealora.data.repository.LinkGmailResult
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** UI states for the link-email flow */
sealed class LinkEmailState {
    data object Idle : LinkEmailState()
    data object Linking : LinkEmailState()
    data class Success(val linkedEmail: String) : LinkEmailState()
    data class Error(val message: String) : LinkEmailState()
}

@HiltViewModel
class LinkEmailViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val connectEmailRepository: ConnectEmailRepository
) : ViewModel() {

    companion object {
        private const val TAG = "LinkEmailViewModel"
    }

    private val _state = MutableStateFlow<LinkEmailState>(LinkEmailState.Idle)
    val state: StateFlow<LinkEmailState> = _state.asStateFlow()

    /**
     * GoogleSignInClient configured to request:
     *  - the user's email address
     *  - a serverAuthCode (one-time code the backend exchanges for a refresh_token)
     *  - offline access so the backend gets a refresh_token (not just an id_token)
     *
     * IMPORTANT: requestServerAuthCode() with requestOfflineAccess() is what causes
     * Google to return account.serverAuthCode in the sign-in result.
     */
    val googleSignInClient: GoogleSignInClient by lazy {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            // This is the key call — tells Google to issue a serverAuthCode
            // that the backend will exchange for access + refresh tokens.
            .requestServerAuthCode(BuildConfig.GOOGLE_WEB_CLIENT_ID, /* requestOfflineAccess = */ true)
            .requestScopes(Scope("https://www.googleapis.com/auth/gmail.readonly"))
            .build()

        // Force account chooser every time so the user can pick a DIFFERENT gmail account
        // each time they tap "+" (rather than silently reusing the last signed-in account).
        val client = GoogleSignIn.getClient(context, gso)
        client
    }

    /**
     * Called from the screen after the Google Sign-In Activity result arrives.
     *
     * [account.serverAuthCode] is the one-time code from Google.
     * It is only valid for a few minutes and can only be used ONCE.
     * We immediately forward it to our backend.
     */
    fun handleSignInResult(account: GoogleSignInAccount?) {
        if (account == null) {
            _state.value = LinkEmailState.Error("Sign-in was cancelled or failed.")
            return
        }

        val serverAuthCode = account.serverAuthCode
        if (serverAuthCode == null) {
            Log.e(TAG, "serverAuthCode is null — check that requestServerAuthCode() is called with the correct Web Client ID")
            _state.value = LinkEmailState.Error(
                "Could not get authorisation code from Google. " +
                "Make sure the Web Client ID in local.properties matches the one in Google Cloud Console."
            )
            return
        }

        val userId = FirebaseAuth.getInstance().currentUser?.uid
        if (userId == null) {
            _state.value = LinkEmailState.Error("You must be logged in to link a Gmail account.")
            return
        }

        Log.d(TAG, "serverAuthCode received for ${account.email}, sending to backend…")

        viewModelScope.launch {
            _state.value = LinkEmailState.Linking
            when (val result = connectEmailRepository.linkGmail(serverAuthCode, userId)) {
                is LinkGmailResult.Success -> {
                    Log.d(TAG, "Linked: ${result.email}")
                    _state.value = LinkEmailState.Success(result.email)
                }
                is LinkGmailResult.Error -> {
                    Log.e(TAG, "Link failed: ${result.message}")
                    _state.value = LinkEmailState.Error(result.message)
                }
            }
        }
    }

    fun resetState() {
        _state.value = LinkEmailState.Idle
    }
}
