package com.ayaan.dealora.ui.presentation.home.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun SyncBannerCard(
    onSyncClick: () -> Unit,
    modifier: Modifier = Modifier,
    characterDrawable: Int = R.drawable.sync_banner_man
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xffF0F0F0))
            .border(
                width = 1.dp,
                color = Color.Black.copy(alpha = 0.1f),
                shape = RoundedCornerShape(20.dp)
            )
            .clickable { onSyncClick() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {

            Image(
                painter = painterResource(id = characterDrawable),
                contentDescription = "null",
                contentScale = ContentScale.FillHeight,
                modifier = Modifier
                    .weight(0.45f)
                    .aspectRatio(1f)
            )

            Column(
                modifier = Modifier
                    .weight(0.55f)
                    .padding(end = 2.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.Start
            ) {

                // "Sync Your Apps," — italic, plain
                Text(
                    text = "Sync Your Apps,",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    fontStyle = FontStyle.Italic,
                    color = Color.Black,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(4.dp))

                // "Unlock Every Deal" — bold white text on purple pill
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(DealoraPrimary)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Unlock Every Deal",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White,
                        lineHeight = 20.sp
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Bullet points
                val bullets = listOf(
                    "Organize all your earned deals automatically",
                    "Track expiry & get timely reminders",
                    "Never miss a savings opportunity again"
                )
                bullets.forEach { bullet ->
                    Row(
                        verticalAlignment = Alignment.Top,
//                        modifier = Modifier.padding(vertical = 3.dp)
                    ) {
                        Text(
                            text = "• ",
                            fontSize = 7.sp,
                            color = Color.Black,
                            lineHeight = 15.sp
                        )
                        Text(
                            text = bullet,
                            style = TextStyle(
                                fontSize = 9.sp,
                                lineHeight = 15.sp,
                                fontWeight = FontWeight(400),
                                color = Color(0xFF000000),
                            )
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))

//                Spacer(modifier = Modifier.height(12.dp))

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(DealoraPrimary)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Sync My Apps",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White,
                        lineHeight = 20.sp
                    )
                }
            }
        }
    }
}
@Composable
fun ExclusiveBannerCard(
    onSyncClick: () -> Unit,
    modifier: Modifier = Modifier,
    characterDrawable: Int = R.drawable.sync_banner_man
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xffF0F0F0))
            .border(
                width = 1.dp,
                color = Color.Black.copy(alpha = 0.1f),
                shape = RoundedCornerShape(20.dp)
            )
            .clickable { onSyncClick() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {

            Image(
                painter = painterResource(id = characterDrawable),
                contentDescription = "null",
                contentScale = ContentScale.FillHeight,
                modifier = Modifier
                    .weight(0.45f)
                    .aspectRatio(1f)
            )

            Column(
                modifier = Modifier
                    .weight(0.55f)
                    .padding(end = 2.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.Start
            ) {

                // "Sync Your Apps," — italic, plain
                Text(
                    text = "Find Exclusive Coupons,",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    fontStyle = FontStyle.Italic,
                    color = Color.Black,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(4.dp))

                // "Unlock Every Deal" — bold white text on purple pill
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(DealoraPrimary)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Never Miss a Deal",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White,
                        lineHeight = 20.sp
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Bullet points
                val bullets = listOf(
                    "Access handpicked coupons in one place",
                    "Unlock limited-time deals from top brands",
                    "Maximize savings on every purchase"
                )
                bullets.forEach { bullet ->
                    Row(
                        verticalAlignment = Alignment.Top,
                    ) {
                        Text(
                            text = "• ",
                            fontSize = 7.sp,
                            color = Color.Black,
                            lineHeight = 15.sp
                        )
                        Text(
                            text = bullet,
                            style = TextStyle(
                                fontSize = 9.sp,
                                lineHeight = 15.sp,
                                fontWeight = FontWeight(400),
                                color = Color(0xFF000000),
                            )
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))

//                Spacer(modifier = Modifier.height(12.dp))

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(DealoraPrimary)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Explore Here",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White,
                        lineHeight = 20.sp
                    )
                }
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFFF5F5F5)
@Composable
fun SyncBannerCardPreview() {
    ExclusiveBannerCard(onSyncClick = {})
}