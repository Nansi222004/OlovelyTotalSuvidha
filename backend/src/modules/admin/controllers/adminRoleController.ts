import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Role from "../../../models/Role";

/**
 * Get all roles
 */
export const getRoles = asyncHandler(async (req: Request, res: Response) => {
    const {
        page = 1,
        limit = 10,
        search = "",
        type,
        sortBy = "createdAt",
        sortOrder = "desc",
    } = req.query;

    const query: any = {};

    // Search filter
    if (search) {
        query.name = { $regex: search, $options: "i" };
    }

    // Type filter
    if (type) {
        query.type = type;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const [roles, total] = await Promise.all([
        Role.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit as string)),
        Role.countDocuments(query),
    ]);

    return res.status(200).json({
        success: true,
        message: "Roles fetched successfully",
        data: roles,
        pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            pages: Math.ceil(total / parseInt(limit as string)),
        },
    });
});

/**
 * Get role by ID
 */
export const getRoleById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
        return res.status(404).json({
            success: false,
            message: "Role not found",
        });
    }

    return res.status(200).json({
        success: true,
        message: "Role fetched successfully",
        data: role,
    });
});

/**
 * Create a new role
 */
export const createRole = asyncHandler(async (req: Request, res: Response) => {
    const { name, permissions, description } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "Role name is required",
        });
    }

    // Check if role already exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
        return res.status(400).json({
            success: false,
            message: "Role with this name already exists",
        });
    }

    const role = await Role.create({
        name,
        permissions: permissions || [],
        description,
        type: "Custom", // Only custom roles can be created via API
    });

    return res.status(201).json({
        success: true,
        message: "Role created successfully",
        data: role,
    });
});

/**
 * Update role
 */
export const updateRole = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, permissions, description } = req.body;

    const role = await Role.findById(id);

    if (!role) {
        return res.status(404).json({
            success: false,
            message: "Role not found",
        });
    }

    // Prevent updating system roles
    if (role.type === "System") {
        return res.status(403).json({
            success: false,
            message: "System roles cannot be modified",
        });
    }

    if (name && name !== role.name) {
        const existingRole = await Role.findOne({ name });
        if (existingRole) {
            return res.status(400).json({
                success: false,
                message: "Role with this name already exists",
            });
        }
        role.name = name;
    }

    if (permissions !== undefined) role.permissions = permissions;
    if (description !== undefined) role.description = description;

    await role.save();

    return res.status(200).json({
        success: true,
        message: "Role updated successfully",
        data: role,
    });
});

/**
 * Delete role
 */
export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
        return res.status(404).json({
            success: false,
            message: "Role not found",
        });
    }

    // Prevent deleting system roles
    if (role.type === "System") {
        return res.status(403).json({
            success: false,
            message: "System roles cannot be deleted",
        });
    }

    await Role.findByIdAndDelete(id);

    return res.status(200).json({
        success: true,
        message: "Role deleted successfully",
    });
});

/**
 * Get available permissions
 */
export const getPermissions = asyncHandler(async (_req: Request, res: Response) => {
    // Define all available permissions in the system
    const permissions = [
        "dashboard_view",
        "users_view",
        "users_manage",
        "products_view",
        "products_manage",
        "orders_view",
        "orders_manage",
        "delivery_view",
        "delivery_manage",
        "wallet_view",
        "wallet_manage",
        "settings_view",
        "settings_manage",
        "roles_view",
        "roles_manage",
        "content_view",
        "content_manage",
        "reports_view",
    ];

    return res.status(200).json({
        success: true,
        message: "Permissions fetched successfully",
        data: permissions,
    });
});
