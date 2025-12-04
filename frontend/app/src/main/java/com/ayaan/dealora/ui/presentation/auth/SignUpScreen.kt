package com.ayaan.dealora.ui.presentation.auth

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
import androidx.compose.material3.ExperimentalMaterial3Api
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
import com.ayaan.dealora.ui.presentation.components.DealoraButton
import com.ayaan.dealora.ui.presentation.components.DealoraLabeledTextField
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraWhite

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignUpScreen(
    navController: NavController, onSignUpClick: () -> Unit = {}, onLoginClick: () -> Unit = {}
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DealoraWhite)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Banner()

        // Form Section
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
                .padding(top = 32.dp)
        ) {
            // Name Field
            DealoraLabeledTextField(
                label = "Name",
                value = name,
                onValueChange = { name = it },
                isRequired = true
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Email Field
            DealoraLabeledTextField(
                label = "Email",
                value = email,
                onValueChange = { email = it },
                isRequired = true,
                keyboardType = KeyboardType.Email
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Phone Number Field
            DealoraLabeledTextField(
                label = "Phone Number",
                value = phoneNumber,
                onValueChange = { phoneNumber = it },
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

        Spacer(modifier = Modifier.weight(2f))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
        ) {
            // Sign Up Button
            DealoraButton(
                text = "Sign Up",
                onClick = onSignUpClick
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Login Link
            Row(
                modifier = Modifier.fillMaxWidth().clickable{
                    onLoginClick()
                }, horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "Already have an account? ", fontSize = 14.sp, color = Color.Black
                )
                    Text(
                        text = "Login",
                        fontSize = 14.sp,
                        color = DealoraPrimary,
                        fontWeight = FontWeight.Bold,
                    )
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}