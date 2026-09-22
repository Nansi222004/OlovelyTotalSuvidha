import { Request, Response } from "express";
import Address from "../../../models/Address";

// Add a new address
export const addAddress = async (req: Request, res: Response) => {
    try {
        const { name, fullName, phone, flat, street, city, state, pincode, landmark, type, isDefault, latitude, longitude } = req.body;
        const userId = req.user!.userId;

        const finalName = (fullName || name || "").trim();
        const cleanPhone = (phone || "").toString().trim().replace(/\D/g, "");
        const cleanFlat = (flat || "").trim();
        const cleanStreet = (street || "").trim();
        const cleanCity = (city || "").trim();
        const cleanPincode = (pincode || "").toString().trim().replace(/\D/g, "");

        const missingFields: string[] = [];
        if (!finalName) missingFields.push("name");
        if (!cleanPhone) missingFields.push("phone");
        if (!cleanFlat) missingFields.push("flat/house no.");
        if (!cleanStreet) missingFields.push("street/area");
        if (!cleanCity) missingFields.push("city");
        if (!cleanPincode) missingFields.push("pincode");

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Required address fields missing: ${missingFields.join(", ")}`,
                missingFields,
            });
        }

        if (cleanPhone.length !== 10) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 10-digit mobile number",
            });
        }

        if (cleanPincode.length !== 6) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 6-digit pincode",
            });
        }

        // Combine flat and street for the single 'address' field in schema
        const fullAddress = `${cleanFlat}, ${cleanStreet}`;

        if (isDefault) {
            // If this is default, unsettle others
            await Address.updateMany({ customer: userId }, { isDefault: false });
        }

        // Check if an address of this type already exists for this user
        const existingAddress = await Address.findOne({ customer: userId, type: type || 'Home' });

        if (existingAddress) {
            // Update existing address of this type
            existingAddress.fullName = finalName;
            existingAddress.phone = cleanPhone;
            existingAddress.address = fullAddress;
            existingAddress.city = cleanCity;
            existingAddress.state = state;
            existingAddress.pincode = cleanPincode;
            existingAddress.landmark = landmark;
            if (latitude !== undefined) existingAddress.latitude = latitude;
            if (longitude !== undefined) existingAddress.longitude = longitude;
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
            phone: cleanPhone,
            address: fullAddress, // Mapped
            city: cleanCity,
            state,
            pincode: cleanPincode,
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

        let updateData: any = {};
        if (fullName !== undefined || name !== undefined) {
            updateData.fullName = (fullName || name || "").trim();
        }
        if (phone !== undefined) {
            const cleanPhone = phone.toString().trim().replace(/\D/g, "");
            if (cleanPhone.length !== 10) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid 10-digit mobile number",
                });
            }
            updateData.phone = cleanPhone;
        }
        if (city !== undefined) updateData.city = city.trim();
        if (state !== undefined) updateData.state = state.trim();
        if (pincode !== undefined) {
            const cleanPincode = pincode.toString().trim().replace(/\D/g, "");
            if (cleanPincode.length !== 6) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid 6-digit pincode",
                });
            }
            updateData.pincode = cleanPincode;
        }
        if (landmark !== undefined) updateData.landmark = landmark;
        if (latitude !== undefined) updateData.latitude = latitude;
        if (longitude !== undefined) updateData.longitude = longitude;
        if (type !== undefined) updateData.type = type;

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
