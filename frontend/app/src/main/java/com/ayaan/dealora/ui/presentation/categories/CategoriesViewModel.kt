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
import com.squareup.moshi.Moshi
import com.ayaan.dealora.data.repository.SavedCouponRepository
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.data.api.models.CouponListItem
import kotlinx.coroutines.flow.collectLatest

data class CategoryGroup(
    val name: String,
    val totalCount: Int,
    val coupons: List<CouponListItem>
)

data class CategoriesUiState(
    val isLoading: Boolean = false,
    val categoryGroups: List<CategoryGroup> = emptyList(),
    val errorMessage: String? = null,
    val isPublicMode: Boolean = false,
    val savedCouponIds: Set<String> = emptySet()
)

@HiltViewModel
class CategoriesViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val syncedAppRepository: SyncedAppRepository,
    private val savedCouponRepository: SavedCouponRepository,
    private val firebaseAuth: FirebaseAuth,
    private val moshi: Moshi
) : ViewModel() {

    private val _uiState = MutableStateFlow(CategoriesUiState())
    val uiState: StateFlow<CategoriesUiState> = _uiState.asStateFlow()

    private val categories = listOf(
        "Food", "Fashion", "Grocery", "Wallet Rewards", "Beauty", "Travel", "Entertainment"
    )

    // Store original private coupons to ensure full data is saved
    private val privateCouponsMap = mutableMapOf<String, PrivateCoupon>()

    init {
        fetchAllCategories()
        observeSavedCoupons()
    }

    private fun observeSavedCoupons() {
        viewModelScope.launch {
            savedCouponRepository.getAllSavedCoupons().collectLatest { savedCoupons ->
                val ids = savedCoupons.map { it.couponId }.toSet()
                _uiState.update { it.copy(savedCouponIds = ids) }
            }
        }
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
                if (!isPublicMode) privateCouponsMap.clear()

                if (isPublicMode) {
                    for (category in categories) {
                        try {
                            val data = couponRepository.getCouponsByCategory(uid = uid, category = category, limit = 10)
                            if (data != null && data.total > 0) {
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
                                
                                if (result is PrivateCouponResult.Success && result.coupons.isNotEmpty()) {
                                    val mappedCoupons = result.coupons.map { privateCoupon ->
                                        // Store original for saving later
                                        privateCouponsMap[privateCoupon.id] = privateCoupon
                                        
                                        CouponListItem(
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

    fun saveCoupon(couponId: String, coupon: CouponListItem) {
        viewModelScope.launch {
            try {
                if (_uiState.value.isPublicMode) {
                    Log.d("CategoriesViewModel", "Saving public coupon: $couponId")
                    val adapter = moshi.adapter(CouponListItem::class.java)
                    val couponJson = adapter.toJson(coupon)
                    savedCouponRepository.saveCoupon(
                        couponId = couponId,
                        couponJson = couponJson,
                        couponType = "public"
                    )
                } else {
                    val privateCoupon = privateCouponsMap[couponId]
                    if (privateCoupon != null) {
                        Log.d("CategoriesViewModel", "Saving private coupon: $couponId")
                        val adapter = moshi.adapter(PrivateCoupon::class.java)
                        val couponJson = adapter.toJson(privateCoupon)
                        savedCouponRepository.saveCoupon(
                            couponId = couponId,
                            couponJson = couponJson,
                            couponType = "private"
                        )
                    } else {
                        Log.w("CategoriesViewModel", "Private coupon not found for saving: $couponId")
                    }
                }
            } catch (e: Exception) {
                Log.e("CategoriesViewModel", "Error saving coupon: $couponId", e)
            }
        }
    }

    fun removeSavedCoupon(couponId: String) {
        viewModelScope.launch {
            try {
                savedCouponRepository.removeSavedCoupon(couponId)
            } catch (e: Exception) {
                Log.e("CategoriesViewModel", "Error removing coupon: $couponId", e)
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        Log.d("CategoriesViewModel", "Search query: $query")
    }
}
