package com.ayaan.dealora.ui.presentation.navigation.navbar

import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraGray
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(navController: NavController) {
    TopAppBar(
        title = {
            Image(
                painter = painterResource(R.drawable.dealora_topbar_banner),
                contentDescription = "Top Bar Image",
                modifier = Modifier.size(140.dp)
            )
        },
        actions = {
            Row {
                Box(
                    modifier = Modifier
                        .size(35.dp)
                        .border(1.dp, DealoraGray, CircleShape)
                        .padding(5.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.Notifications,
                        contentDescription = "Notifications",
                        modifier = Modifier.size(30.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Box(
                    modifier = Modifier
                        .size(35.dp)
                        .border(1.dp, DealoraGray, CircleShape)
                        .padding(5.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.Person,
                        contentDescription = "Profile",
                        modifier = Modifier.size(30.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))
            }
        },
        windowInsets = WindowInsets(0)
    )
}
@Preview
@Composable
fun AppTopBarPreview(){
    AppTopBar(navController = NavController(LocalContext.current))
}
