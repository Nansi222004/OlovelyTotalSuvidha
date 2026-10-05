import crypto from 'node:crypto';
import Seller, { ISeller } from '../../models/Seller';
import ShiprocketPickupRetirement from '../../models/ShiprocketPickupRetirement';
import { shiprocketHttpClient } from './shiprocketHttpClient';

export type PickupProvisioningStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'FAILED'
  | 'RETIRING'
  | 'RETRY_PENDING'
  | 'RETIRED';

export type PickupCleanupStatus = 'NOT_REQUIRED' | 'RETIRED';

export interface ShiprocketPickupAddress {
  id?: string | number;
  pickup_id?: string | number;
  pickup_location?: string;
  pickup_code?: string;
  address?: string;
  address_2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
  status?: string | number | boolean;
  is_primary?: boolean | number;
  is_primary_location?: boolean | number;
}

export interface ShiprocketPickupApi {
  listPickupLocations(): Promise<ShiprocketPickupAddress[]>;
  createPickupLocation(payload: Record<string, string>): Promise<{
    id: string;
    name: string;
    raw?: unknown;
  }>;
}

export interface PickupProvisioningResult {
  required: boolean;
  status: PickupProvisioningStatus;
  created?: boolean;
  reused?: boolean;
  locationId?: string;
  locationName?: string;
  message: string;
}

export interface PickupCleanupResult {
  required: boolean;
  status: PickupCleanupStatus;
  alreadyRetired?: boolean;
  remoteLocationFound?: boolean;
  message: string;
}

export class ShiprocketPickupCleanupError extends Error {
  public readonly statusCode: number;
  public readonly apiCode: string;

  constructor(apiCode: string, message: string, statusCode = 409) {
    super(message);
    this.name = 'ShiprocketPickupCleanupError';
    this.apiCode = apiCode;
    this.statusCode = statusCode;
  }
}

const normalize = (value: unknown): string => String(value || '').trim();
const normalizeComparable = (value: unknown): string => normalize(value).replace(/\s+/g, ' ').toLowerCase();

export function isShiprocketPickupRequired(vendorType?: string): boolean {
  return vendorType === 'ECOMMERCE' || vendorType === 'HYBRID';
}

export function buildShiprocketPickupLocationName(sellerId: string): string {
  const safeId = sellerId.replace(/[^a-zA-Z0-9]/g, '').slice(-24).toUpperCase();
  return `OLOVELY-${safeId}`.slice(0, 36);
}

function splitAddress(address: string): { address: string; address_2: string } {
  if (address.length <= 80) return { address, address_2: '' };
  const splitAt = Math.max(address.lastIndexOf(' ', 80), 1);
  return {
    address: address.slice(0, splitAt).trim(),
    address_2: address.slice(splitAt).trim().slice(0, 80),
  };
}

export function buildShiprocketPickupPayload(seller: Pick<
  ISeller,
  '_id' | 'sellerName' | 'storeName' | 'email' | 'mobile' | 'city' | 'shippingConfig'
>): Record<string, string> {
  const config = seller.shippingConfig;
  const pickupAddress = normalize(config?.pickupAddress || config?.warehouseAddress);
  const pickupPincode = normalize(config?.pickupPincode);
  const pickupCity = normalize(config?.pickupCity || seller.city);
  const pickupState = normalize(config?.pickupState);
  const name = normalize(seller.storeName || seller.sellerName);
  const email = normalize(seller.email).toLowerCase();
  const phone = normalize(seller.mobile).replace(/\D/g, '').slice(-10);

  const missing: string[] = [];
  if (!pickupAddress) missing.push('pickup address');
  if (!/^[1-9][0-9]{5}$/.test(pickupPincode)) missing.push('valid 6-digit pickup pincode');
  if (!pickupCity) missing.push('pickup city');
  if (!pickupState) missing.push('pickup state');
  if (!name) missing.push('vendor/business name');
  if (!/^\S+@\S+\.\S+$/.test(email)) missing.push('valid email');
  if (!/^[6-9][0-9]{9}$/.test(phone)) missing.push('valid 10-digit phone');
  if (pickupAddress.length > 160) missing.push('pickup address of at most 160 characters');

  if (missing.length > 0) {
    throw new Error(`Pickup setup requires: ${missing.join(', ')}`);
  }

  const lines = splitAddress(pickupAddress);
  return {
    pickup_location: buildShiprocketPickupLocationName(String(seller._id)),
    name,
    email,
    phone,
    address: lines.address,
    address_2: lines.address_2,
    city: pickupCity,
    state: pickupState,
    country: 'India',
    pin_code: pickupPincode,
  };
}

export function getPickupAddressFingerprint(payload: Record<string, string>): string {
  const addressFields = ['address', 'address_2', 'city', 'state', 'country', 'pin_code'];
  return crypto
    .createHash('sha256')
    .update(addressFields.map((field) => normalizeComparable(payload[field])).join('|'))
    .digest('hex');
}

function pickupMatchesPayload(remote: ShiprocketPickupAddress, payload: Record<string, string>): boolean {
  return (
    normalizeComparable(remote.address) === normalizeComparable(payload.address) &&
    normalizeComparable(remote.address_2) === normalizeComparable(payload.address_2) &&
    normalizeComparable(remote.city) === normalizeComparable(payload.city) &&
    normalizeComparable(remote.state) === normalizeComparable(payload.state) &&
    normalizeComparable(remote.country || 'India') === normalizeComparable(payload.country) &&
    normalize(remote.pin_code) === normalize(payload.pin_code)
  );
}

function getRemoteId(remote: ShiprocketPickupAddress): string {
  return normalize(remote.pickup_id || remote.id || remote.pickup_code || remote.pickup_location);
}

function remoteAddressFingerprint(remote: ShiprocketPickupAddress): string {
  return getPickupAddressFingerprint({
    address: normalize(remote.address),
    address_2: normalize(remote.address_2),
    city: normalize(remote.city),
    state: normalize(remote.state),
    country: normalize(remote.country || 'India'),
    pin_code: normalize(remote.pin_code),
  });
}

const RESERVED_PICKUP_NAMES = new Set(['home', 'primary', 'default', 'admin', 'admin warehouse', 'main warehouse']);

function isPrimaryOrAdminPickup(remote: ShiprocketPickupAddress | undefined, name: string): boolean {
  const normalizedName = normalizeComparable(remote?.pickup_location || name);
  return Boolean(
    remote?.is_primary === true || remote?.is_primary === 1 ||
    remote?.is_primary_location === true || remote?.is_primary_location === 1 ||
    RESERVED_PICKUP_NAMES.has(normalizedName)
  );
}

async function markCleanupPending(sellerId: string, message: string): Promise<void> {
  await Seller.updateOne(
    { _id: sellerId },
    {
      $set: {
        'shippingConfig.shiprocketPickupStatus': 'RETRY_PENDING',
        'shippingConfig.shiprocketPickupLastError': message,
      },
      $unset: { 'shippingConfig.shiprocketPickupCleanupStartedAt': 1 },
    }
  );
}

/**
 * Retires a seller-owned Shiprocket pickup before permanent seller deletion.
 *
 * Shiprocket's documented pickup-address API currently supports list and create only;
 * it does not expose a supported delete/deactivate operation. We therefore verify the
 * stored ID against the deterministic seller name, refuse primary/admin targets, write
 * a durable local audit tombstone, and make the seller pickup ineligible for shipment.
 */
export async function cleanupSellerShiprocketPickup(
  sellerInput: Pick<ISeller, '_id' | 'vendorType' | 'isPlatform' | 'shippingConfig'>,
  api: ShiprocketPickupApi = shiprocketPickupApi
): Promise<PickupCleanupResult> {
  const sellerId = String(sellerInput._id);
  if (!isShiprocketPickupRequired(sellerInput.vendorType)) {
    return {
      required: false,
      status: 'NOT_REQUIRED',
      message: 'Courier pickup cleanup is not required for Quick Commerce vendors.',
    };
  }

  const expectedName = buildShiprocketPickupLocationName(sellerId);
  const initialConfig = sellerInput.shippingConfig;

  if (sellerInput.isPlatform || isPrimaryOrAdminPickup(undefined, initialConfig?.shiprocketPickupLocationName || '')) {
    throw new ShiprocketPickupCleanupError(
      'SHIPROCKET_PICKUP_PROTECTED',
      'Seller deletion was stopped because the courier pickup target is a protected platform location.'
    );
  }
  if (
    initialConfig?.shiprocketPickupLocationName &&
    normalizeComparable(initialConfig.shiprocketPickupLocationName) !== normalizeComparable(expectedName)
  ) {
    throw new ShiprocketPickupCleanupError(
      'SHIPROCKET_PICKUP_IDENTITY_MISMATCH',
      'Seller deletion was stopped because the courier pickup identity did not match this vendor.'
    );
  }
  if (initialConfig?.shiprocketPickupStatus === 'RETIRED') {
    return {
      required: true,
      status: 'RETIRED',
      alreadyRetired: true,
      message: 'Courier pickup was already retired locally.',
    };
  }

  const leaseExpiry = new Date(Date.now() - 5 * 60 * 1000);
  const leasedSeller = await Seller.findOneAndUpdate(
    {
      _id: sellerId,
      $or: [
        { 'shippingConfig.shiprocketPickupStatus': { $ne: 'RETIRING' } },
        { 'shippingConfig.shiprocketPickupCleanupStartedAt': { $lt: leaseExpiry } },
      ],
    },
    {
      $set: {
        'shippingConfig.shiprocketPickupStatus': 'RETIRING',
        'shippingConfig.shiprocketPickupCleanupStartedAt': new Date(),
      },
      $unset: { 'shippingConfig.shiprocketPickupLastError': 1 },
    },
    { new: true }
  );

  if (!leasedSeller) {
    throw new ShiprocketPickupCleanupError(
      'SHIPROCKET_PICKUP_CLEANUP_IN_PROGRESS',
      'Courier pickup cleanup is already in progress. Please retry shortly.',
      409
    );
  }

  const config = leasedSeller.shippingConfig || initialConfig;
  const storedId = normalize(config?.shiprocketPickupLocationId);
  try {
    const locations = await api.listPickupLocations();
    const remoteById = storedId
      ? locations.find((location) => getRemoteId(location) === storedId)
      : undefined;
    const remoteByName = locations.find(
      (location) => normalizeComparable(location.pickup_location) === normalizeComparable(expectedName)
    );

    if (storedId && !remoteById && remoteByName) {
      throw new ShiprocketPickupCleanupError(
        'SHIPROCKET_PICKUP_IDENTITY_MISMATCH',
        'Seller deletion was stopped because the stored courier pickup ID did not match this vendor.'
      );
    }

    const remote = remoteById || (!storedId ? remoteByName : undefined);
    if (remote) {
      if (
        normalizeComparable(remote.pickup_location) !== normalizeComparable(expectedName) ||
        isPrimaryOrAdminPickup(remote, expectedName)
      ) {
        throw new ShiprocketPickupCleanupError(
          'SHIPROCKET_PICKUP_PROTECTED',
          'Seller deletion was stopped because the courier pickup target is protected or belongs to another vendor.'
        );
      }
      if (
        config?.shiprocketPickupAddressFingerprint &&
        remoteAddressFingerprint(remote) !== config.shiprocketPickupAddressFingerprint
      ) {
        throw new ShiprocketPickupCleanupError(
          'SHIPROCKET_PICKUP_ADDRESS_MISMATCH',
          'Seller deletion was stopped because the courier pickup address did not match the synchronized vendor address.'
        );
      }
    }

    const retiredAt = new Date();
    await ShiprocketPickupRetirement.updateOne(
      { sellerId: sellerInput._id },
      {
        $setOnInsert: {
          sellerId: sellerInput._id,
          pickupLocationId: storedId || (remote ? getRemoteId(remote) : undefined),
          pickupLocationName: expectedName,
          addressFingerprint: config?.shiprocketPickupAddressFingerprint,
          retiredAt,
          remoteRemovalSupported: false,
          reason: 'SELLER_DELETED',
        },
      },
      { upsert: true }
    );

    await Seller.updateOne(
      { _id: sellerId },
      {
        $set: {
          'shippingConfig.shiprocketPickupStatus': 'RETIRED',
          'shippingConfig.shiprocketPickupRetiredAt': retiredAt,
          'shippingConfig.shiprocketPickupLastError':
            'Shiprocket does not provide a supported pickup-address removal API; this vendor pickup is retired locally and cannot be used for new shipments.',
        },
        $unset: { 'shippingConfig.shiprocketPickupCleanupStartedAt': 1 },
      }
    );

    return {
      required: true,
      status: 'RETIRED',
      remoteLocationFound: Boolean(remote),
      message: 'Courier pickup retired locally; remote address removal is not supported by the documented Shiprocket API.',
    };
  } catch (error) {
    const publicMessage = error instanceof ShiprocketPickupCleanupError
      ? error.message
      : 'Seller deletion is pending because the courier pickup could not be verified. Please retry when the courier service is available.';
    await markCleanupPending(sellerId, publicMessage);
    if (error instanceof ShiprocketPickupCleanupError) throw error;
    throw new ShiprocketPickupCleanupError('SHIPROCKET_PICKUP_CLEANUP_PENDING', publicMessage, 503);
  }
}

export const shiprocketPickupApi: ShiprocketPickupApi = {
  async listPickupLocations() {
    const response = await shiprocketHttpClient.request<any>({
      method: 'GET',
      url: '/v1/external/settings/company/pickup',
    });
    const locations = response?.data?.shipping_address || response?.shipping_address || response?.data || [];
    return Array.isArray(locations) ? locations : [];
  },

  async createPickupLocation(payload) {
    const response = await shiprocketHttpClient.request<any>({
      method: 'POST',
      url: '/v1/external/settings/company/addpickup',
      data: payload,
    });
    const address = response?.address || response?.data?.address || {};
    const id = normalize(response?.pickup_id || response?.data?.pickup_id || address?.id || address?.pickup_code);
    if (!response?.success || !id) {
      throw new Error('Shiprocket pickup API returned an incomplete response');
    }
    return { id, name: payload.pickup_location, raw: response };
  },
};

function safeIntegrationError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (message.startsWith('Pickup setup requires:')) return message;
  const status = (error as any)?.statusCode;
  return `Courier pickup provisioning failed${status ? ` (HTTP ${status})` : ''}. Retry when the courier service is available.`;
}

async function markFailed(sellerId: string, message: string): Promise<void> {
  await Seller.updateOne(
    { _id: sellerId },
    {
      $set: {
        'shippingConfig.shiprocketPickupStatus': 'FAILED',
        'shippingConfig.shiprocketPickupLastError': message,
      },
      $unset: { 'shippingConfig.shiprocketPickupSyncStartedAt': 1 },
    }
  );
}

/**
 * Provisions exactly one deterministic pickup location for an approved Ecommerce-capable seller.
 * The remote list-before-create check recovers safely if the remote create succeeded but the
 * local save failed. A short DB lease prevents concurrent approval/retry calls from creating twice.
 */
export async function provisionShiprocketPickupLocation(
  sellerId: string,
  api: ShiprocketPickupApi = shiprocketPickupApi
): Promise<PickupProvisioningResult> {
  const seller = await Seller.findById(sellerId);
  if (!seller) throw new Error('Seller not found');

  if (!isShiprocketPickupRequired(seller.vendorType)) {
    await Seller.updateOne(
      { _id: sellerId },
      {
        $set: { 'shippingConfig.shiprocketPickupStatus': 'NOT_REQUIRED' },
        $unset: {
          'shippingConfig.shiprocketPickupLastError': 1,
          'shippingConfig.shiprocketPickupSyncStartedAt': 1,
        },
      }
    );
    return { required: false, status: 'NOT_REQUIRED', message: 'Courier pickup is not required for Quick Commerce vendors.' };
  }

  if (['RETIRING', 'RETRY_PENDING', 'RETIRED'].includes(seller.shippingConfig?.shiprocketPickupStatus || '')) {
    const status = seller.shippingConfig!.shiprocketPickupStatus as 'RETIRING' | 'RETRY_PENDING' | 'RETIRED';
    return {
      required: true,
      status,
      locationId: seller.shippingConfig?.shiprocketPickupLocationId,
      locationName: seller.shippingConfig?.shiprocketPickupLocationName,
      message: 'Courier pickup provisioning is disabled while seller pickup cleanup is pending or complete.',
    };
  }

  let payload: Record<string, string>;
  try {
    payload = buildShiprocketPickupPayload(seller);
  } catch (error) {
    const message = safeIntegrationError(error);
    await markFailed(sellerId, message);
    return { required: true, status: 'FAILED', message };
  }

  const fingerprint = getPickupAddressFingerprint(payload);
  const config = seller.shippingConfig;
  if (
    config?.shiprocketPickupLocationId &&
    config.shiprocketPickupStatus === 'ACTIVE' &&
    config.shiprocketPickupAddressFingerprint === fingerprint
  ) {
    return {
      required: true,
      status: 'ACTIVE',
      reused: true,
      locationId: config.shiprocketPickupLocationId,
      locationName: config.shiprocketPickupLocationName,
      message: 'Courier pickup location is already active.',
    };
  }

  const leaseExpiry = new Date(Date.now() - 5 * 60 * 1000);
  const leasedSeller = await Seller.findOneAndUpdate(
    {
      _id: sellerId,
      $or: [
        { 'shippingConfig.shiprocketPickupStatus': { $ne: 'PROVISIONING' } },
        { 'shippingConfig.shiprocketPickupSyncStartedAt': { $lt: leaseExpiry } },
      ],
    },
    {
      $set: {
        'shippingConfig.shiprocketPickupStatus': 'PROVISIONING',
        'shippingConfig.shiprocketPickupSyncStartedAt': new Date(),
      },
      $unset: { 'shippingConfig.shiprocketPickupLastError': 1 },
    },
    { new: true }
  );

  if (!leasedSeller) {
    return { required: true, status: 'PROVISIONING', message: 'Courier pickup provisioning is already in progress.' };
  }

  try {
    const locations = await api.listPickupLocations();
    const existing = locations.find(
      (location) => normalizeComparable(location.pickup_location) === normalizeComparable(payload.pickup_location)
    );

    if (existing && !pickupMatchesPayload(existing, payload)) {
      const message = 'The vendor pickup address changed. Update the existing courier pickup location in the Shiprocket dashboard, then retry synchronization; no duplicate location was created.';
      await markFailed(sellerId, message);
      return {
        required: true,
        status: 'FAILED',
        locationId: getRemoteId(existing),
        locationName: payload.pickup_location,
        message,
      };
    }

    const provisioned = existing
      ? { id: getRemoteId(existing), name: payload.pickup_location, created: false }
      : { ...(await api.createPickupLocation(payload)), created: true };

    await Seller.updateOne(
      { _id: sellerId },
      {
        $set: {
          'shippingConfig.shiprocketPickupLocationId': provisioned.id,
          'shippingConfig.shiprocketPickupLocationName': provisioned.name,
          'shippingConfig.shiprocketPickupStatus': 'ACTIVE',
          'shippingConfig.shiprocketPickupAddressFingerprint': fingerprint,
          'shippingConfig.shiprocketPickupLastSyncedAt': new Date(),
        },
        $unset: {
          'shippingConfig.shiprocketPickupLastError': 1,
          'shippingConfig.shiprocketPickupSyncStartedAt': 1,
        },
      }
    );

    return {
      required: true,
      status: 'ACTIVE',
      created: provisioned.created,
      reused: !provisioned.created,
      locationId: provisioned.id,
      locationName: provisioned.name,
      message: provisioned.created ? 'Courier pickup location created.' : 'Existing courier pickup location synchronized.',
    };
  } catch (error) {
    const message = safeIntegrationError(error);
    await markFailed(sellerId, message);
    return { required: true, status: 'FAILED', message };
  }
}
