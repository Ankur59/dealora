package com.ayaan.dealora.ui.presentation.couponsList.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.common.components.SearchBar
import com.ayaan.dealora.ui.theme.DealoraGray
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraWhite

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CouponsListTopBar(
    searchQuery: String = "",
    onSearchQueryChanged: (String) -> Unit = {},
    onBackClick: () -> Unit = {},
    isPublicMode: Boolean = false,
    onPublicModeChanged: (Boolean) -> Unit = {}
) {

    TopAppBar(
        windowInsets = WindowInsets(0.dp),
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = DealoraWhite
        ),
        title = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(end = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {

                // 🔙 Back button
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .border(
                            width = 1.5.dp,
                            color = DealoraGray,
                            shape = CircleShape
                        )
                        .clickable { onBackClick() },
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(R.drawable.arrow_left),
                        contentDescription = "Back",
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                // 🔍 Search bar (takes remaining space)
                Box(
                    modifier = Modifier.weight(1f)
                ) {
                    SearchBar(
                        value = searchQuery,
                        onValueChange = onSearchQueryChanged
                    )
                }
            }
        },

        actions = {
            Column(
                modifier = Modifier.padding(end = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {

                Switch(
                    checked = isPublicMode,
                    onCheckedChange = onPublicModeChanged,
                    modifier = Modifier.height(24.dp),
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = DealoraPrimary,
                        checkedBorderColor=DealoraPrimary,
                        checkedTrackColor = Color.White,
                        uncheckedTrackColor = Color.White
                    )
                )

                Text(
                    text = if (!isPublicMode) "Private" else "Public",
                    color = Color.Black,
                    fontSize = 12.sp,
                    modifier = Modifier.offset(y = (-6).dp)
                )
            }
        }
    )
}
