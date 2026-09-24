import { Request, Response } from "express";
import Address from "../../../models/Address";
import Customer from "../../../models/Customer";

// Safely synchronize customer profile name ONLY if the customer's profile is still
// the uninitialized placeholder ("User" or empty) and a non-empty name was provided.
// Protection: If the customer already has a real name (e.g. "Nansi"), it is NEVER overwritten
// by a delivery address recipient name (e.g. "Ajay Tiwari").
export const syncCustomerProfileName = async (userId: string, rawFullName?: string): Promise<string | undefined> => {
    if (!userId) return undefined;
    try {
        const customerDoc = await Customer.findById(userId);
        if (!customerDoc) return undefined;

        const currentName = (customerDoc.name || "").trim();
        const isPlaceholderName = !currentName || currentName.toLowerCase() === "user";

        if (isPlaceholderName && rawFullName && rawFullName.trim()) {
            const formattedName = rawFullName
                .trim()
                .split(/\s+/)
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(" ");

            if (formattedName && formattedName.toLowerCase() !== "user") {
                customerDoc.name = formattedName;
                await customerDoc.save();
                if (process.env.NODE_ENV !== "production") {
                    console.log("[CUSTOMER_PROFILE_SYNC] Customer profile name initialized to:", formattedName);
                }
                return formattedName;
            }
        }
        return customerDoc.name;
    } catch (profErr) {
        console.warn("[CUSTOMER_PROFILE_SYNC] Non-blocking customer profile sync warning:", profErr);
        return undefined;
    }
};

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

        const validLat = (latitude !== undefined && latitude !== null && latitude !== '' && !isNaN(Number(latitude)))
            ? Number(latitude)
            : (latitude === null ? null : undefined);
        const validLng = (longitude !== undefined && longitude !== null && longitude !== '' && !isNaN(Number(longitude)))
            ? Number(longitude)
            : (longitude === null ? null : undefined);

        // Check if an address of this type already exists for this user
        const existingAddress = await Address.findOne({ customer: userId, type: type || 'Home' });

        if (existingAddress) {
            // Update existing address of this type
            existingAddress.fullName = finalName;
            existingAddress.phone = cleanPhone;
            existingAddress.address = fullAddress;
            existingAddress.city = cleanCity;
            if (state !== undefined) existingAddress.state = state ? state.trim() : "";
            existingAddress.pincode = cleanPincode;
            if (landmark !== undefined) existingAddress.landmark = landmark ? landmark.trim() : "";
            if (validLat !== undefined) existingAddress.latitude = validLat === null ? undefined : validLat;
            if (validLng !== undefined) existingAddress.longitude = validLng === null ? undefined : validLng;
            existingAddress.isDefault = isDefault !== undefined ? Boolean(isDefault) : existingAddress.isDefault;

            await existingAddress.save();

            if (process.env.NODE_ENV !== "production") {
                console.log("[ADDRESS_SYNC_DEBUG] 5. Backend addAddress updated existing record:", {
                    id: existingAddress._id,
                    userId,
                    address: existingAddress.address,
                    city: existingAddress.city,
                    pincode: existingAddress.pincode,
                    latitude: existingAddress.latitude,
                    longitude: existingAddress.longitude
                });
            }

            const resolvedProfileName = await syncCustomerProfileName(userId, finalName);

            return res.status(200).json({
                success: true,
                data: existingAddress,
                customerProfileName: resolvedProfileName,
                message: "Address updated successfully"
            });
        }

        const newAddress = new Address({
            customer: userId,
            fullName: finalName,
            phone: cleanPhone,
            address: fullAddress, // Mapped
            city: cleanCity,
            state: state ? state.trim() : undefined,
            pincode: cleanPincode,
            landmark: landmark ? landmark.trim() : undefined,
            latitude: validLat !== null && validLat !== undefined ? validLat : undefined,
            longitude: validLng !== null && validLng !== undefined ? validLng : undefined,
            type: type || 'Home',
            isDefault: isDefault || false,
        });

        await newAddress.save();

        if (process.env.NODE_ENV !== "production") {
            console.log("[ADDRESS_SYNC_DEBUG] 6. Database Record After Save (new):", {
                id: newAddress._id,
                userId,
                address: newAddress.address,
                city: newAddress.city,
                pincode: newAddress.pincode,
                latitude: newAddress.latitude,
                longitude: newAddress.longitude
            });
        }

        const resolvedProfileName = await syncCustomerProfileName(userId, finalName);

        return res.status(201).json({
            success: true,
            data: newAddress,
            customerProfileName: resolvedProfileName,
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

        if (process.env.NODE_ENV !== "production") {
            console.log("[ADDRESS_SYNC_DEBUG] 7. Backend Returning Addresses:", addresses.map(a => ({
                id: a._id,
                fullName: a.fullName,
                address: a.address,
                city: a.city,
                pincode: a.pincode,
                latitude: a.latitude,
                longitude: a.longitude,
                isDefault: a.isDefault,
            })));
        }

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
        if (landmark !== undefined) updateData.landmark = landmark ? landmark.trim() : "";

        const validLat = (latitude !== undefined && latitude !== null && latitude !== '' && !isNaN(Number(latitude)))
            ? Number(latitude)
            : (latitude === null ? null : undefined);
        const validLng = (longitude !== undefined && longitude !== null && longitude !== '' && !isNaN(Number(longitude)))
            ? Number(longitude)
            : (longitude === null ? null : undefined);

        if (validLat !== undefined) updateData.latitude = validLat === null ? undefined : validLat;
        if (validLng !== undefined) updateData.longitude = validLng === null ? undefined : validLng;
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

        if (process.env.NODE_ENV !== "production") {
            console.log("[ADDRESS_SYNC_DEBUG] 5. Backend updateAddress processed:", {
                id,
                userId,
                address: address.address,
                city: address.city,
                pincode: address.pincode,
                latitude: address.latitude,
                longitude: address.longitude,
            });
        }

        const rawCandidateName = updateData.fullName || name || req.body?.fullName || req.body?.name;
        const resolvedProfileName = await syncCustomerProfileName(userId, rawCandidateName);

        return res.status(200).json({
            success: true,
            data: address,
            customerProfileName: resolvedProfileName,
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
