package com.ayaan.dealora.ui.presentation.auth

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.auth.components.Banner
import com.ayaan.dealora.ui.presentation.common.components.DealoraButton
import com.ayaan.dealora.ui.presentation.common.components.DealoraLabeledTextField
import com.ayaan.dealora.ui.presentation.common.components.OtpInputField
import com.ayaan.dealora.ui.theme.DealoraGreen
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraWhite

@Composable
fun LoginScreen(
    navController: NavController, onSignUpClick: () -> Unit = {}, onLoginClick: () -> Unit = {}
){
//    var name by remember { mutableStateOf("") }
//    var email by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }
    var isOtpScreen by remember { mutableStateOf(false) }
    var otpValue by remember { mutableStateOf("") }
    BackHandler(
        enabled = isOtpScreen, onBack = { isOtpScreen = false })
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DealoraWhite)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Banner(
            painter = painterResource(R.drawable.hey_welcome_banner)
        )

        // SWITCH BETWEEN FORM UI & OTP UI
        if (!isOtpScreen) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp)
                    .padding(top = 32.dp)
            ) {

//                DealoraLabeledTextField(
//                    label = "Name", value = name, onValueChange = { name = it }, isRequired = true
//                )

//                Spacer(modifier = Modifier.height(24.dp))

//                DealoraLabeledTextField(
//                    label = "Email",
//                    value = email,
//                    onValueChange = { email = it },
//                    isRequired = true,
//                    keyboardType = KeyboardType.Email
//                )

                Spacer(modifier = Modifier.height(24.dp))

                DealoraLabeledTextField(
                    label = "Phone Number",
                    value = phoneNumber,
                    onValueChange = {
                        if (phoneNumber.length < 10) phoneNumber = it
                    },
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
                    })

                Spacer(modifier = Modifier.height(48.dp))
            }

        } else {
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
                    }", fontSize = 14.sp, color = Color.Gray
                )

                Spacer(modifier = Modifier.height(32.dp))

                OtpInputField(
                    otpText = otpValue, onOtpTextChange = { otpValue = it }, otpCount = 6
                )

                Spacer(modifier = Modifier.height(24.dp))
                Row {
                    Text(text = "Didn't receive the code?", color = Color.Gray, fontSize = 14.sp)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "Resend Code", color = DealoraGreen, fontSize = 14.sp)
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
        }


        Spacer(modifier = Modifier.weight(2f))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
        ) {
            // Sign Up Button
            DealoraButton(
                text = if (isOtpScreen) "Verify" else "Sign In", onClick = {
                    if (!isOtpScreen) {
                        // Switch to OTP UI
                        isOtpScreen = true
                    } else {
                        onSignUpClick()
                    }
                },
                contentColor = Color.White,
                backgroundColor=DealoraGreen
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Login Link
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        onLoginClick()
                    }, horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "Already have an account? ", fontSize = 14.sp, color = Color.Black
                )
                Text(
                    text = "Login",
                    fontSize = 14.sp,
                    color = DealoraGreen,
                    fontWeight = FontWeight.Bold,
                )
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}