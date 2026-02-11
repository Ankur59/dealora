package com.ayaan.dealora.ui.presentation.categories

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.CouponListItem
import com.ayaan.dealora.data.repository.CouponRepository
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlinx.coroutines.flow.first
import androidx.paging.PagingData
import kotlinx.coroutines.flow.Flow

data class CategoryGroup(
    val name: String,
    val totalCount: Int,
    val coupons: List<CouponListItem>
)

data class CategoriesUiState(
    val isLoading: Boolean = false,
    val categoryGroups: List<CategoryGroup> = emptyList(),
    val errorMessage: String? = null
)

@HiltViewModel
class CategoriesViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    private val _uiState = MutableStateFlow(CategoriesUiState())
    val uiState: StateFlow<CategoriesUiState> = _uiState.asStateFlow()

    private val categories = listOf(
        "Food", "Fashion", "Grocery", "Wallet Rewards", "Beauty", "Travel", "Entertainment"
    )

    init {
        fetchAllCategories()
    }

    fun fetchAllCategories() {
        val uid = firebaseAuth.currentUser?.uid ?: return
        
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        
        viewModelScope.launch {
            try {
                val groups = mutableListOf<CategoryGroup>()
                
                for (category in categories) {
                    val data = couponRepository.getCouponsByCategory(uid = uid, category = category, limit = 10)
                    if (data != null) {
                        groups.add(
                            CategoryGroup(
                                name = category,
                                totalCount = data.total,
                                coupons = data.coupons
                            )
                        )
                    }
                }
                
                _uiState.update { 
                    it.copy(
                        isLoading = false, 
                        categoryGroups = groups,
                        errorMessage = if (groups.isEmpty()) "No categories found" else null
                    ) 
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        // Implement search across categories if needed, 
        // or just filter the currently loaded categories locally
    }
}
