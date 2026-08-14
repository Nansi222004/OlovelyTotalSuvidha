import { Request, Response } from "express";
import Address from "../../../models/Address";

// Add a new address
export const addAddress = async (req: Request, res: Response) => {
    try {
        const { name, fullName, phone, flat, street, city, state, pincode, landmark, type, isDefault, latitude, longitude } = req.body;
        const userId = req.user!.userId;

        const finalName = fullName || name;

        if (!finalName || !phone || !flat || !street || !city || !pincode) {
            return res.status(400).json({
                success: false,
                message: "All fields are required (name, phone, flat, street, city, pincode)",
            });
        }

        // Combine flat and street for the single 'address' field in schema,
        // or we could change schema. For now, we store them combined or rely on schema update.
        // Looking at the schema, it has 'address', 'city', 'pincode'.
        // We will store "Flat, Street" in 'address'.
        const fullAddress = `${flat}, ${street}`;

        if (isDefault) {
            // If this is default, unsettle others
            await Address.updateMany({ customer: userId }, { isDefault: false });
        }

        // Check if an address of this type already exists for this user
        const existingAddress = await Address.findOne({ customer: userId, type: type || 'Home' });

        if (existingAddress) {
            // Update existing address of this type
            existingAddress.fullName = finalName;
            existingAddress.phone = phone;
            existingAddress.address = fullAddress;
            existingAddress.city = city;
            existingAddress.state = state;
            existingAddress.pincode = pincode;
            existingAddress.isDefault = isDefault || false;

            await existingAddress.save();

            return res.status(200).json({
                success: true,
                data: existingAddress,
                message: "Address updated successfully"
            });
        }

        const newAddress = new Address({
            customer: userId,
            fullName: finalName,
            phone,
            address: fullAddress, // Mapped
            city,
            state,
            pincode,
            landmark,
            latitude,
            longitude,
            type: type || 'Home',
            isDefault: isDefault || false,
        });

        await newAddress.save();

        return res.status(201).json({
            success: true,
            data: newAddress,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error adding address",
            error: error.message,
        });
    }
};

// Get all addresses for user
export const getMyAddresses = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const addresses = await Address.find({ customer: userId }).sort({ isDefault: -1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: addresses,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching addresses",
            error: error.message,
        });
    }
};

// Update address
export const updateAddress = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, fullName, phone, flat, street, city, state, pincode, landmark, type, isDefault, latitude, longitude } = req.body;
        const userId = req.user!.userId;

        const finalName = fullName || name;

        let updateData: any = {
            fullName: finalName,
            phone,
            city,
            state,
            pincode,
            landmark,
            latitude,
            longitude,
            type,
        };

        if (flat && street) {
            updateData.address = `${flat}, ${street}`;
        } else if (req.body.address) {
            // Allow direct update if client sends it
            updateData.address = req.body.address;
        }

        if (isDefault) {
            await Address.updateMany({ customer: userId }, { isDefault: false });
            updateData.isDefault = true;
        }

        const address = await Address.findOneAndUpdate(
            { _id: id, customer: userId },
            updateData,
            { new: true }
        );

        if (!address) {
            return res.status(404).json({
                success: false,
                message: "Address not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: address,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error updating address",
            error: error.message,
        });
    }
};

// Delete address
export const deleteAddress = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const address = await Address.findOneAndDelete({ _id: id, customer: userId });

        if (!address) {
            return res.status(404).json({
                success: false,
                message: "Address not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Address deleted successfully",
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error deleting address",
            error: error.message,
        });
    }
};
