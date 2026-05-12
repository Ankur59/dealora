package com.ayaan.dealora.ui.presentation.auth.screens.signup

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ayaan.dealora.ui.presentation.auth.screens.signup.SignUpViewModel
import com.ayaan.dealora.ui.presentation.auth.components.Banner
import com.ayaan.dealora.ui.presentation.common.components.DealoraButton
import com.ayaan.dealora.ui.presentation.common.components.OtpInputField
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraWhite

@Composable
fun SignUpOtpScreen(
    onNavigateBack: () -> Unit,
    onNavigateToHome: () -> Unit,
    viewModel: SignUpViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val activity = context as? Activity

    val uiState by viewModel.uiState.collectAsState()
    val phoneNumber by viewModel.phoneNumber.collectAsState()
    val otp by viewModel.otp.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    // Handle back press
    BackHandler {
        onNavigateBack()
    }

    // Handle success navigation
    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            viewModel.consumeSuccess()
            onNavigateToHome()
        }
    }

    // Handle error messages
    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.consumeError()
        }
    }

    Scaffold(
        topBar = { Banner() },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(DealoraWhite)
                .verticalScroll(rememberScrollState())
                .padding(padding),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp)
                    .padding(top = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Phone Number Verification",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "OTP has been sent to ${
                        phoneNumber.takeLast(4).padStart(phoneNumber.length, '*')
                    }",
                    fontSize = 14.sp,
                    color = Color.Gray
                )

                Spacer(modifier = Modifier.height(32.dp))

                OtpInputField(
                    otpText = otp,
                    onOtpTextChange = viewModel::onOtpChanged,
                    otpCount = 6
                )

                Spacer(modifier = Modifier.height(24.dp))

                Row {
                    Text(
                        text = "Didn't receive the code?",
                        color = Color.Gray,
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.width(4.dp))

                    if (uiState.otpTimeRemainingSec > 0) {
                        Text(
                            text = "Resend in ${uiState.otpTimeRemainingSec}s",
                            color = Color.Gray,
                            fontSize = 14.sp
                        )
                    } else {
                        Text(
                            text = "Resend Code",
                            color = DealoraPrimary,
                            fontSize = 14.sp,
                            modifier = Modifier.clickable {
                                activity?.let { viewModel.resendOtp(it) }
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }

            Spacer(modifier = Modifier.weight(1f))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp)
            ) {
                DealoraButton(
                    text = "Verify",
                    onClick = { viewModel.verifyOtp() },
                    enabled = !uiState.isOtpVerifying && otp.length == 6
                )

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

