package com.ayaan.dealora.ui.presentation.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraBackground
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraRed
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
        // Top Banner with stars
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(230.dp), contentAlignment = Alignment.Center
        ) {
            // Placeholder for banner drawable (R.drawable.banner_bg)
            Image(
                painter = painterResource(id = R.drawable.create_account_banner),
                contentDescription = "Banner",
                modifier = Modifier.fillMaxSize()
            )

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Top,
                modifier = Modifier.padding(bottom = 40.dp)
            ) {
                Text(
                    text = "Dealora",
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = DealoraWhite
                )

                Spacer(modifier = Modifier.height(32.dp))

                Text(
                    text = "CREATE YOUR\nACCOUNT",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = DealoraWhite,
                    textAlign = TextAlign.Center,
                    lineHeight = 28.sp
                )
            }
        }

        // Form Section
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
                .padding(top = 32.dp)
        ) {
            // Name Field
            Text(
                text = buildAnnotatedString {
                    append("Name")
                    withStyle(style = SpanStyle(color = DealoraRed)) {
                        append("*")
                    }
                }, fontSize = 16.sp, fontWeight = FontWeight.Medium, color = Color.Black
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = DealoraBackground,
                    focusedContainerColor = DealoraBackground,
                    unfocusedBorderColor = Color.Transparent,
                    focusedBorderColor = DealoraPrimary
                ),
                shape = RoundedCornerShape(12.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Email Field
            Text(
                text = buildAnnotatedString {
                    append("Email")
                    withStyle(style = SpanStyle(color = DealoraRed)) {
                        append("*")
                    }
                }, fontSize = 16.sp, fontWeight = FontWeight.Medium, color = Color.Black
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = DealoraBackground,
                    focusedContainerColor = DealoraBackground,
                    unfocusedBorderColor = Color.Transparent,
                    focusedBorderColor = DealoraPrimary
                ),
                shape = RoundedCornerShape(12.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Phone Number Field
            Text(
                text = buildAnnotatedString {
                    append("Phone Number")
                    withStyle(style = SpanStyle(color = DealoraRed)) {
                        append("*")
                    }
                }, fontSize = 16.sp, fontWeight = FontWeight.Medium, color = Color.Black
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Country Code Box
                OutlinedTextField(
                    value = "+91",
                    onValueChange = {},
                    modifier = Modifier.width(100.dp),
                    readOnly = true,
                    leadingIcon = {
                        // Placeholder for India flag drawable (R.drawable.india_flag)
                        Image(
                            painter = painterResource(id = R.drawable.india_flag),
                            contentDescription = "India Flag",
                            modifier = Modifier.size(24.dp)
                        )
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = DealoraBackground,
                        focusedContainerColor = DealoraBackground,
                        unfocusedBorderColor = Color.Transparent,
                        focusedBorderColor = DealoraPrimary
                    ),
                    shape = RoundedCornerShape(12.dp)
                )

                // Phone Number Input
                OutlinedTextField(
                    value = phoneNumber,
                    onValueChange = { phoneNumber = it },
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = DealoraBackground,
                        focusedContainerColor = DealoraBackground,
                        unfocusedBorderColor = Color.Transparent,
                        focusedBorderColor = DealoraPrimary
                    ),
                    shape = RoundedCornerShape(12.dp)
                )
            }

            Spacer(modifier = Modifier.height(48.dp))
        }

        Spacer(modifier = Modifier.weight(2f))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
        ) {
            // Sign Up Button
            Button(
                onClick = onSignUpClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = DealoraPrimary
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = "Sign Up", fontSize = 18.sp, fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Login Link
            Row(
                modifier = Modifier.fillMaxWidth().clickable{
                    onLoginClick
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