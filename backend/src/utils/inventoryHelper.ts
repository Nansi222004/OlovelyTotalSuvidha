/**
 * inventoryHelper.ts
 *
 * Centralized utility for resolving product and inventory transaction ownership.
 * Distinguishes platform-managed inventory from vendor-owned inventory.
 */

import mongoose from 'mongoose';
import Seller, { ISeller } from '../models/Seller';

export interface ResolvedInventoryOwner {
  isPlatform: boolean;
  ownerType: 'PLATFORM' | 'VENDOR';
  ownerLabel: string;
  sellerId?: string;
  sellerName?: string;
  storeName?: string;
  email?: string;
}

/**
 * Resolves whether an inventory record belongs to Platform Inventory or an individual Vendor.
 * Uses explicit model flags (ownerType, isPlatform) with safe backward-compatible fallbacks.
 * Never silently reclassifies authentic vendors.
 */
export function resolveInventoryOwner(
  sellerDoc?: any,
  productDoc?: any
): ResolvedInventoryOwner {
  const isPlatformProduct = productDoc?.ownerType === 'PLATFORM';
  const isPlatformSeller =
    sellerDoc?.isPlatform === true ||
    sellerDoc?.category === 'Admin' ||
    sellerDoc?.email === 'admin-store@olovely.com' ||
    sellerDoc?.sellerName === 'Olovely Admin' ||
    sellerDoc?.storeName === 'Olovely Admin Store';

  if (isPlatformProduct || isPlatformSeller || !sellerDoc) {
    return {
      isPlatform: true,
      ownerType: 'PLATFORM',
      ownerLabel: 'Admin / Platform Inventory',
      sellerId: sellerDoc?._id?.toString(),
      sellerName: sellerDoc?.sellerName || 'Olovely Admin',
      storeName: sellerDoc?.storeName || 'Olovely Admin Store',
      email: sellerDoc?.email || 'admin-store@olovely.com',
    };
  }

  const storeName = sellerDoc.storeName || '';
  const sellerName = sellerDoc.sellerName || '';
  const ownerLabel = storeName || sellerName || 'Vendor';

  return {
    isPlatform: false,
    ownerType: 'VENDOR',
    ownerLabel,
    sellerId: sellerDoc._id?.toString(),
    sellerName,
    storeName,
    email: sellerDoc.email,
  };
}

/**
 * Safely fetches or initializes the canonical Admin Seller.
 * Guarantees isPlatform: true.
 */
export async function getCanonicalAdminSeller(): Promise<ISeller> {
  let adminSeller = await Seller.findOne({
    $or: [
      { isPlatform: true },
      { email: 'admin-store@olovely.com' },
      { mobile: '9999999999' },
      { sellerName: 'Olovely Admin' },
    ],
  });

  if (!adminSeller) {
    adminSeller = await Seller.create({
      sellerName: 'Olovely Admin',
      storeName: 'Olovely Admin Store',
      email: 'admin-store@olovely.com',
      mobile: '9999999999',
      password: 'AdminStore@123',
      address: '',
      city: '',
      category: 'Admin',
      commission: 0,
      status: 'Approved',
      requireProductApproval: false,
      isPlatform: true,
      vendorType: 'HYBRID',
      wholesaleEnabled: true,
      isShopOpen: true,
    });
  } else if (!adminSeller.isPlatform || adminSeller.vendorType !== 'HYBRID') {
    adminSeller.isPlatform = true;
    adminSeller.vendorType = 'HYBRID';
    await adminSeller.save();
  }

  return adminSeller;
}

/**
 * Retrieves ObjectIds for all platform/admin sellers to filter DB queries.
 */
export async function getPlatformSellerIds(): Promise<mongoose.Types.ObjectId[]> {
  const sellers = await Seller.find({
    $or: [
      { isPlatform: true },
      { category: 'Admin' },
      { email: 'admin-store@olovely.com' },
      { sellerName: 'Olovely Admin' },
      { storeName: 'Olovely Admin Store' },
    ],
  }).select('_id');

  return sellers.map((s) => s._id as mongoose.Types.ObjectId);
}
