import mongoose from "mongoose";
import Category from "../models/Category";
import SubCategory from "../models/SubCategory";
import Product from "../models/Product";
import dotenv from "dotenv";

dotenv.config();

/**
 * Migration script to move SubCategory data to Category model with parentId
 * This consolidates the hierarchical structure into a single Category model
 */
async function migrateSubCategoriesToCategories() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Get all SubCategories
    const subCategories = await SubCategory.find().populate("category");
    console.log(`Found ${subCategories.length} subcategories to migrate`);

    if (subCategories.length === 0) {
      console.log("No subcategories to migrate. Exiting.");
      await mongoose.disconnect();
      return;
    }

    const results = {
      migrated: 0,
      failed: 0,
      errors: [] as Array<{ subcategoryId: string; error: string }>,
      productUpdates: 0,
    };

    // Migrate each SubCategory
    for (const subCategory of subCategories) {
      try {
        // Get parent category ID
        const parentId = subCategory.category
          ? (subCategory.category as any)._id || subCategory.category
          : null;

        if (!parentId) {
          console.log(
            `SubCategory "${subCategory.name}" has no parent category. Skipping.`
          );
          results.failed++;
          results.errors.push({
            subcategoryId: subCategory._id.toString(),
            error: "No parent category found",
          });
          continue;
        }

        // Get parent category to inherit headerCategoryId
        const parentCategory = await Category.findById(parentId);
        if (!parentCategory) {
          console.log(
            `Parent category not found for subcategory "${subCategory.name}". Skipping.`
          );
          results.failed++;
          results.errors.push({
            subcategoryId: subCategory._id.toString(),
            error: "Parent category not found",
          });
          continue;
        }

        // Check if category already exists with same name and parent
        const existingCategory = await Category.findOne({
          name: subCategory.name,
          parentId: parentId,
        });

        if (existingCategory) {
          console.log(
            `Category "${subCategory.name}" already exists under parent "${parentCategory.name}". Skipping migration.`
          );
          // Update products to use existing category and clear subcategory reference
          const productUpdateResult = await Product.updateMany(
            { subcategory: subCategory._id },
            {
              $set: { category: existingCategory._id },
              $unset: { subcategory: "" },
            }
          );
          results.productUpdates += productUpdateResult.modifiedCount || 0;
          continue;
        }

        // Inherit headerCategoryId from parent if parent has one
        const headerCategoryId = parentCategory.headerCategoryId || null;

        // Create new Category from SubCategory
        const newCategory = await Category.create({
          name: subCategory.name,
          image: subCategory.image,
          order: subCategory.order || 0,
          parentId: parentId,
          headerCategoryId: headerCategoryId, // Inherit from parent
          status: "Active",
          isBestseller: false,
          hasWarning: false,
        });

        console.log(
          `Migrated subcategory "${subCategory.name}" to category with ID: ${
            newCategory._id
          } (parent: ${parentCategory.name}, headerCategory: ${
            headerCategoryId ? "inherited" : "none"
          })`
        );

        // Update all products that reference this SubCategory
        // Set category to new category and clear subcategory field
        const productUpdateResult = await Product.updateMany(
          { subcategory: subCategory._id },
          {
            $set: { category: newCategory._id },
            $unset: { subcategory: "" },
          }
        );
        results.productUpdates += productUpdateResult.modifiedCount || 0;

        results.migrated++;
      } catch (error: any) {
        console.error(
          `Error migrating subcategory ${subCategory._id}:`,
          error.message
        );
        results.failed++;
        results.errors.push({
          subcategoryId: subCategory._id.toString(),
          error: error.message,
        });
      }
    }

    // Print migration results
    console.log("\n=== Migration Results ===");
    console.log(`Total subcategories: ${subCategories.length}`);
    console.log(`Successfully migrated: ${results.migrated}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Products updated: ${results.productUpdates}`);

    if (results.errors.length > 0) {
      console.log("\n=== Errors ===");
      results.errors.forEach((err) => {
        console.log(`SubCategory ID: ${err.subcategoryId} - ${err.error}`);
      });
    }

    // Ask if user wants to delete SubCategory collection
    console.log("\n=== Next Steps ===");
    console.log("1. Verify the migrated categories in the database");
    console.log("2. Test the category hierarchy functionality");
    console.log(
      "3. Once verified, you can manually delete SubCategory documents if desired"
    );
    console.log("   (SubCategory model is kept for backward compatibility)");

    await mongoose.disconnect();
    console.log("\nMigration completed. Disconnected from MongoDB.");
  } catch (error: any) {
    console.error("Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateSubCategoriesToCategories()
    .then(() => {
      console.log("Migration script finished.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script error:", error);
      process.exit(1);
    });
}

export default migrateSubCategoriesToCategories;

