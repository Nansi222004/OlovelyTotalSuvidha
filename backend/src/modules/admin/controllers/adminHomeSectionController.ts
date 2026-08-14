import { Request, Response } from "express";
import HomeSection from "../../../models/HomeSection";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import mongoose from "mongoose";

// Helper function to populate subCategories from both SubCategory and Category collections
const populateSubCategories = async (sections: any) => {
    if (!sections) return;
    const isArray = Array.isArray(sections);
    const sectionsList = isArray ? sections : [sections];

    // Gather all unique subcategory IDs
    const subCategoryIds: string[] = [];
    sectionsList.forEach((section) => {
        if (section && section.subCategories && section.subCategories.length > 0) {
            section.subCategories.forEach((id: any) => {
                if (id) {
                    const idStr = id.toString();
                    if (!subCategoryIds.includes(idStr)) {
                        subCategoryIds.push(idStr);
                    }
                }
            });
        }
    });

    if (subCategoryIds.length === 0) {
        return;
    }

    // Fetch names from both collections
    const subCats = await SubCategory.find({ _id: { $in: subCategoryIds } })
        .select("name")
        .lean();

    const catSubs = await Category.find({ _id: { $in: subCategoryIds } })
        .select("name")
        .lean();

    // Create lookup map
    const nameMap = new Map<string, string>();
    subCats.forEach((item) => nameMap.set(item._id.toString(), item.name));
    catSubs.forEach((item) => nameMap.set(item._id.toString(), item.name));

    // Replace the IDs with populated objects in the list
    sectionsList.forEach((section) => {
        if (section && section.subCategories && section.subCategories.length > 0) {
            section.subCategories = section.subCategories.map((idVal: any) => {
                const idStr = idVal.toString();
                return {
                    _id: idStr,
                    name: nameMap.get(idStr) || "Unknown Subcategory",
                };
            });
        }
    });
};

// Get all home sections
export const getHomeSections = async (_req: Request, res: Response) => {
    try {
        const sections = await HomeSection.find()
            .populate("categories", "name slug image")
            .populate("targetHeaderCategory", "name")
            .sort({ order: 1 })
            .lean();

        await populateSubCategories(sections);

        return res.status(200).json({
            success: true,
            data: sections,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching home sections",
            error: error.message,
        });
    }
};

// Get single home section by ID
export const getHomeSectionById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section ID",
            });
        }

        const section = await HomeSection.findById(id)
            .populate("categories", "name slug image")
            .populate("targetHeaderCategory", "name")
            .lean();

        await populateSubCategories(section);

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "Home section not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: section,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching home section",
            error: error.message,
        });
    }
};

// Create new home section
export const createHomeSection = async (req: Request, res: Response) => {
    try {
        const { title, slug, categories, subCategories, displayType, columns, limit, order, isActive, pageLocation, targetHeaderCategory } = req.body;

        // Validate required fields
        if (!title || !slug || !displayType) {
            return res.status(400).json({
                success: false,
                message: "Title, slug, and display type are required",
            });
        }

        // Check if slug already exists
        const existingSection = await HomeSection.findOne({ slug });
        if (existingSection) {
            return res.status(400).json({
                success: false,
                message: "A section with this slug already exists",
            });
        }

        // If no order specified, set it to the end
        let sectionOrder = order;
        if (sectionOrder === undefined || sectionOrder === null) {
            const maxOrderSection = await HomeSection.findOne().sort({ order: -1 }).lean();
            sectionOrder = maxOrderSection ? maxOrderSection.order + 1 : 0;
        }

        const newSection = new HomeSection({
            title,
            slug,
            categories: categories || [],
            subCategories: subCategories || [],
            displayType,
            columns: columns || 4,
            limit: limit || 8,
            order: sectionOrder,
            isActive: isActive !== undefined ? isActive : true,
            pageLocation: pageLocation || "Home Page",
            targetHeaderCategory: targetHeaderCategory || undefined,
        });

        await newSection.save();

        const populatedSection = await HomeSection.findById(newSection._id)
            .populate("categories", "name slug image")
            .populate("targetHeaderCategory", "name")
            .lean();

        await populateSubCategories(populatedSection);

        return res.status(201).json({
            success: true,
            message: "Home section created successfully",
            data: populatedSection,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error creating home section",
            error: error.message,
        });
    }
};

// Update home section
export const updateHomeSection = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, slug, categories, subCategories, displayType, columns, limit, order, isActive, pageLocation, targetHeaderCategory } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section ID",
            });
        }

        const section = await HomeSection.findById(id);
        if (!section) {
            return res.status(404).json({
                success: false,
                message: "Home section not found",
            });
        }

        // Check if slug is being changed and if it already exists
        if (slug && slug !== section.slug) {
            const existingSection = await HomeSection.findOne({ slug });
            if (existingSection) {
                return res.status(400).json({
                    success: false,
                    message: "A section with this slug already exists",
                });
            }
        }

        // Update fields
        if (title !== undefined) section.title = title;
        if (slug !== undefined) section.slug = slug;
        if (categories !== undefined) section.categories = categories || [];
        if (subCategories !== undefined) section.subCategories = subCategories || [];
        if (displayType !== undefined) section.displayType = displayType;
        if (columns !== undefined) section.columns = columns;
        if (limit !== undefined) section.limit = limit;
        if (order !== undefined) section.order = order;
        if (isActive !== undefined) section.isActive = isActive;
        if (pageLocation !== undefined) section.pageLocation = pageLocation;
        if (targetHeaderCategory !== undefined) section.targetHeaderCategory = targetHeaderCategory;

        await section.save();

        const updatedSection = await HomeSection.findById(id)
            .populate("categories", "name slug image")
            .populate("targetHeaderCategory", "name")
            .lean();

        await populateSubCategories(updatedSection);

        return res.status(200).json({
            success: true,
            message: "Home section updated successfully",
            data: updatedSection,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error updating home section",
            error: error.message,
        });
    }
};

// Delete home section
export const deleteHomeSection = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section ID",
            });
        }

        const section = await HomeSection.findByIdAndDelete(id);
        if (!section) {
            return res.status(404).json({
                success: false,
                message: "Home section not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Home section deleted successfully",
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error deleting home section",
            error: error.message,
        });
    }
};

// Reorder home sections
export const reorderHomeSections = async (req: Request, res: Response) => {
    try {
        const { sections } = req.body; // Array of { id, order }

        if (!Array.isArray(sections)) {
            return res.status(400).json({
                success: false,
                message: "Sections must be an array",
            });
        }

        // Update order for each section
        const updatePromises = sections.map(({ id, order }) => {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error(`Invalid section ID: ${id}`);
            }
            return HomeSection.findByIdAndUpdate(id, { order }, { new: true });
        });

        await Promise.all(updatePromises);

        const updatedSections = await HomeSection.find()
            .populate("categories", "name slug image")
            .populate("targetHeaderCategory", "name")
            .sort({ order: 1 })
            .lean();

        await populateSubCategories(updatedSections);

        return res.status(200).json({
            success: true,
            message: "Sections reordered successfully",
            data: updatedSections,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error reordering sections",
            error: error.message,
        });
    }
};
