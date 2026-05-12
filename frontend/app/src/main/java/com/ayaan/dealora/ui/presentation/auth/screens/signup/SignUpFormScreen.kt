package com.ayaan.dealora.ui.presentation.auth.screens.signup

import android.app.Activity
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.auth.screens.signup.SignUpViewModel
import com.ayaan.dealora.ui.presentation.auth.components.Banner
import com.ayaan.dealora.ui.presentation.common.components.DealoraButton
import com.ayaan.dealora.ui.presentation.common.components.DealoraLabeledTextField
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraWhite

@Composable
fun SignUpFormScreen(
    onNavigateToOtp: () -> Unit,
    onNavigateToLogin: () -> Unit,
    viewModel: SignUpViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val activity = context as? Activity

    val uiState by viewModel.uiState.collectAsState()
    val name by viewModel.name.collectAsState()
    val email by viewModel.email.collectAsState()
    val phoneNumber by viewModel.phoneNumber.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    // Handle OTP sent navigation
    LaunchedEffect(uiState.isOtpSent) {
        if (uiState.isOtpSent) {
            onNavigateToOtp()
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
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        topBar = { Banner() }

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
                    .padding(top = 32.dp)
            ) {
                DealoraLabeledTextField(
                    label = "Name",
                    value = name,
                    onValueChange = viewModel::onNameChanged,
                    isRequired = true
                )

                Spacer(modifier = Modifier.height(24.dp))

                DealoraLabeledTextField(
                    label = "Email",
                    value = email,
                    onValueChange = viewModel::onEmailChanged,
                    isRequired = true,
                    keyboardType = KeyboardType.Email
                )

                Spacer(modifier = Modifier.height(24.dp))

                DealoraLabeledTextField(
                    label = "Phone Number",
                    value = phoneNumber,
                    onValueChange = viewModel::onPhoneNumberChanged,
                    isRequired = true,
                    keyboardType = KeyboardType.Phone,
                    leadingIcon = {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(start = 12.dp)
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.india_flag),
                                contentDescription = "India Flag",
                                modifier = Modifier.size(24.dp)
                            )
                            Text(text = "+91", fontSize = 16.sp)
                        }
                    }
                )

                Spacer(modifier = Modifier.height(48.dp))
            }

            Spacer(modifier = Modifier.weight(1f))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp)
            ) {
                DealoraButton(
                    text = "Sign Up",
                    onClick = {
                        activity?.let { viewModel.sendOtp(it) }
                    },
                    enabled = !uiState.isLoading && activity != null
                )

                Spacer(modifier = Modifier.height(24.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToLogin() },
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "Already have an account? ",
                        fontSize = 14.sp,
                        color = Color.Black
                    )
                    Text(
                        text = "Login",
                        fontSize = 14.sp,
                        color = DealoraPrimary,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

