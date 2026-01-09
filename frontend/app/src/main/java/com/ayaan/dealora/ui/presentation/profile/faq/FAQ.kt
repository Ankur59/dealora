package com.ayaan.dealora.ui.presentation.profile.faq

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.profile.components.TopBar
import com.ayaan.dealora.ui.theme.AppColors

data class FAQItem(
    val question: String,
    val answer: String? = null,
    val isExpandable: Boolean = true
)

@Composable
fun FAQScreen(navController: NavController) {
    var searchQuery by remember { mutableStateOf("") }
    var expandedIndex by remember { mutableStateOf<Int?>(null) }
    var questionInput by remember { mutableStateOf("") }

    val faqList = listOf(
        FAQItem(
            question = "How does the app sync coupons from other apps?",
            answer = "We are working on that"
        ),
        FAQItem(
            question = "Is it safe to sync my coupons with this app?",
            answer = "We are working on that"
        ),
        FAQItem(
            question = "How long does the syncing process take?",
            answer = "We are working on that"
        ),
        FAQItem(
            question = "Why are some coupons not visible after syncing?",
            answer = "We are working on that"
        ),
        FAQItem(
            question = "Are my personal details shared with other apps?",
            answer = "No. We never share your personal details with any third-party apps or services. When you sync an app, we only access the information required to fetch your coupons—nothing else."
        )
    )

    // Filter FAQ list based on search query
    val filteredFaqList = remember(searchQuery, faqList) {
        if (searchQuery.isBlank()) {
            faqList
        } else {
            faqList.filter { faq ->
                faq.question.contains(searchQuery, ignoreCase = true) ||
                        (faq.answer?.contains(searchQuery, ignoreCase = true) == true)
            }
        }
    }

    Scaffold(
        topBar = {
            TopBar(
                navController = navController,
                title = "FAQ"
            )
        },
        containerColor = AppColors.Background
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
            }

            // Search Bar
            item {
                SearchBar(
                    query = searchQuery,
                    onQueryChange = { searchQuery = it }
                )
            }

            // FAQ Items
            items(filteredFaqList.size) { index ->
                FAQCard(
                    faqItem = filteredFaqList[index],
                    isExpanded = expandedIndex == index,
                    onClick = {
                        expandedIndex = if (expandedIndex == index) null else index
                    }
                )
            }

            // Ask Question Input
            item {
                Spacer(modifier = Modifier.height(8.dp))
                AskQuestionInput(
                    value = questionInput,
                    onValueChange = { questionInput = it },
                    onSend = {
                        // Handle send action
                        questionInput = ""
                    }
                )
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit
) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        placeholder = {
            Text(
                text = "Search Questions",
                color = AppColors.SecondaryText,
                fontSize = 15.sp
            )
        },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = "Search",
                tint = AppColors.SecondaryText
            )
        },
        colors = TextFieldDefaults.colors(
            focusedContainerColor = AppColors.CardBackground,
            unfocusedContainerColor = AppColors.CardBackground,
            disabledContainerColor = AppColors.CardBackground,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            disabledIndicatorColor = Color.Transparent
        ),
        shape = RoundedCornerShape(12.dp),
        singleLine = true
    )
}

@Composable
fun FAQCard(
    faqItem: FAQItem,
    isExpanded: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 1.dp
        ),
        onClick = onClick
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            // Question Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = faqItem.question,
                    fontSize = 15.sp,
                    color = AppColors.PrimaryText,
                    modifier = Modifier.weight(1f),
                    lineHeight = 22.sp
                )

                Icon(
                    imageVector = if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowRight,
                    contentDescription = if (isExpanded) "Collapse" else "Expand",
                    tint = AppColors.IconTint,
                    modifier = Modifier.size(24.dp)
                )
            }

            // Answer (if expanded and available)
            if (isExpanded && faqItem.answer != null) {
                Spacer(modifier = Modifier.height(12.dp))

                Divider(
                    color = AppColors.Background,
                    thickness = 1.dp
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = faqItem.answer,
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText,
                    lineHeight = 20.sp
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AskQuestionInput(
    value: String,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit
) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        placeholder = {
            Text(
                text = "Ask your question here",
                color = AppColors.SecondaryText,
                fontSize = 15.sp
            )
        },
        trailingIcon = {
            IconButton(onClick = onSend) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send",
                    tint = AppColors.SecondaryText
                )
            }
        },
        colors = TextFieldDefaults.colors(
            focusedContainerColor = AppColors.CardBackground,
            unfocusedContainerColor = AppColors.CardBackground,
            disabledContainerColor = AppColors.CardBackground,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            disabledIndicatorColor = Color.Transparent
        ),
        shape = RoundedCornerShape(12.dp),
        singleLine = true
    )
}