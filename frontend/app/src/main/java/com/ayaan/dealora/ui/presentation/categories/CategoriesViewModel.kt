package com.ayaan.dealora.ui.presentation.categories

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.PrivateCouponResult
import com.ayaan.dealora.data.repository.SyncedAppRepository
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CategoryGroup(
    val name: String,
    val totalCount: Int,
    val coupons: List<com.ayaan.dealora.data.api.models.CouponListItem>
)

data class CategoriesUiState(
    val isLoading: Boolean = false,
    val categoryGroups: List<CategoryGroup> = emptyList(),
    val errorMessage: String? = null,
    val isPublicMode: Boolean = false
)

@HiltViewModel
class CategoriesViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
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

    fun onPublicModeChanged(isPublic: Boolean) {
        _uiState.update { it.copy(isPublicMode = isPublic) }
        fetchAllCategories()
    }

    fun fetchAllCategories() {
        val uid = firebaseAuth.currentUser?.uid ?: return
        val isPublicMode = _uiState.value.isPublicMode
        
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        
        viewModelScope.launch {
            try {
                val groups = mutableListOf<CategoryGroup>()
                
                if (isPublicMode) {
                    for (category in categories) {
                        try {
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
                        } catch (e: Exception) {
                            Log.e("CategoriesViewModel", "Error fetching category $category", e)
                        }
                    }
                } else {
                    // Fetch synced brands for private coupons
                    val syncedApps = syncedAppRepository.getAllSyncedApps().first()
                    val brands = syncedApps.map { it.appName.replaceFirstChar { char -> char.uppercase() } }
                    
                    if (brands.isNotEmpty()) {
                        for (category in categories) {
                            try {
                                val result = couponRepository.syncPrivateCoupons(
                                    brands = brands,
                                    category = category,
                                    limit = 10
                                )
                                
                                if (result is PrivateCouponResult.Success) {
                                    val mappedCoupons = result.coupons.map { privateCoupon ->
                                        com.ayaan.dealora.data.api.models.CouponListItem(
                                            id = privateCoupon.id,
                                            brandName = privateCoupon.brandName,
                                            couponTitle = privateCoupon.couponTitle,
                                            description = privateCoupon.description,
                                            category = privateCoupon.category,
                                            daysUntilExpiry = privateCoupon.daysUntilExpiry,
                                            couponImageBase64 = null
                                        )
                                    }
                                    
                                    groups.add(
                                        CategoryGroup(
                                            name = category,
                                            totalCount = result.coupons.size,
                                            coupons = mappedCoupons
                                        )
                                    )
                                }
                            } catch (e: Exception) {
                                Log.e("CategoriesViewModel", "Error syncing category $category", e)
                            }
                        }
                    }
                }
                
                _uiState.update { 
                    it.copy(
                        isLoading = false, 
                        categoryGroups = groups,
                        errorMessage = if (groups.isEmpty()) "No coupons found" else null
                    ) 
                }
            } catch (e: Exception) {
                Log.e("CategoriesViewModel", "Error fetching categories", e)
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        Log.d("CategoriesViewModel", "Search query: $query")
    }
}
