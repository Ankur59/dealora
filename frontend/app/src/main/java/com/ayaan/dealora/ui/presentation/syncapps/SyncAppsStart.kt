package com.ayaan.dealora.ui.presentation.syncapps

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun SyncAppsStart(
    navController: NavController
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        // Title Section
        Column(
            horizontalAlignment = Alignment.Start,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
        ) {
            Text(
                text = "Sync Your Deals",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black,
                lineHeight = 38.sp
            )

            Box(
                modifier = Modifier
                    .background(
                        color = DealoraPrimary, shape = RoundedCornerShape(4.dp)
                    )
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "Automatically",
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Description Text
        Text(
            text = buildAnnotatedString {
                append("Give ")
                withStyle(
                    style = SpanStyle(
                        color = DealoraPrimary, fontWeight = FontWeight.SemiBold
                    )
                ) {
                    append("Dealora")
                }
                append(" permission to safely read your coupons from other apps")
            },
            fontSize = 15.sp,
            color = Color.Black,
            lineHeight = 22.sp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
        )

        Spacer(modifier = Modifier.weight(1f))

        // Illustration image - NO PADDING
        Image(
            painter = painterResource(id = R.drawable.sync_illustration),
            contentDescription = "Sync illustration",
            modifier = Modifier.fillMaxWidth(),
            contentScale = ContentScale.FillWidth
        )

        Spacer(modifier = Modifier.weight(1f))

        // Privacy Text
        Text(
            text = buildAnnotatedString {
                append("Your information stays ")
                withStyle(
                    style = SpanStyle(
                        color = DealoraPrimary, fontWeight = FontWeight.SemiBold
                    )
                ) {
                    append("Private")
                }
                append(" and ")
                withStyle(
                    style = SpanStyle(
                        color = DealoraPrimary, fontWeight = FontWeight.SemiBold
                    )
                ) {
                    append("Encrypted.")
                }
            },
            fontSize = 14.sp,
            color = Color.Black,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Start Sync Button
        Button(
            onClick = {
                navController.navigate(Route.SelectAppsScreen.path)
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = DealoraPrimary
            ),
            shape = RoundedCornerShape(8.dp)
        ) {
            Text(
                text = "Start Sync",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

//@Preview(showBackground = true, showSystemUi = true)
//@Composable
//fun SyncAppsStartPreview() {
//    SyncAppsStart()
//}