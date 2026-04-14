import { Category } from "../../models/category.model.js";
import { getAllCategories } from "../../providers/coupomated.js";

/**
 * Synchronizes categories from Coupomated to the local database.
 * @returns {Promise<Array>} The list of synced categories
 */
export const syncCategories = async () => {
    const data = await getAllCategories();

    // Coupomated typically returns categories in a 'categories' array or as a direct array
    const categoriesList = Array.isArray(data) ? data : (data?.categories || []);

    for (const cat of categoriesList) {
        // We use findOneAndUpdate with upsert to avoid duplicates and update existing ones
        try {
            await Category.findOneAndUpdate(
                {
                    apiId: String(cat.id),
                    partner: "coupomated"
                },
                {
                    $set: {
                        apiId: String(cat.id),
                        name: cat.name,
                        parentId: String(cat.parent_id),
                        partner: "coupomated"
                    }
                },
                { upsert: true, new: true }
            );
        }
        catch (error) {
            console.log(error)
        }
    }
};
