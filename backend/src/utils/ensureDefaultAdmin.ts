import Admin from '../models/Admin';

const DEFAULT_ADMIN_MOBILE = process.env.DEFAULT_ADMIN_MOBILE || '9876543210';
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@olovely.com';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
const DEFAULT_ADMIN_FIRST = process.env.DEFAULT_ADMIN_FIRST || 'Default';
const DEFAULT_ADMIN_LAST = process.env.DEFAULT_ADMIN_LAST || 'Admin';
const DEFAULT_ADMIN_ROLE = (process.env.DEFAULT_ADMIN_ROLE as 'Super Admin' | 'Admin') || 'Super Admin';

/**
 * Ensure a default admin user exists for quick access to the admin panel.
 * Mobile: 9876543210 (default)
 * Email: admin@olovely.com (default)
 * Password: Admin@123 (not used for OTP login but stored for completeness)
 */
export async function ensureDefaultAdmin() {
  const isProduction = process.env.NODE_ENV === 'production';
  const mobile = process.env.DEFAULT_ADMIN_MOBILE || (isProduction ? '' : '9876543210');
  const email = process.env.DEFAULT_ADMIN_EMAIL || (isProduction ? '' : 'admin@olovely.com');
  const password = process.env.DEFAULT_ADMIN_PASSWORD || (isProduction ? '' : 'Admin@123');

  if (isProduction && (!mobile || !email)) {
    console.log('ℹ️ [Admin Seeding] Default admin auto-creation skipped in production (configure DEFAULT_ADMIN_MOBILE and DEFAULT_ADMIN_EMAIL to enable)');
    return null;
  }

  const existing = await Admin.findOne({
    $or: [{ mobile }, { email }],
  });

  if (existing) {
    console.log(`Default admin already exists (mobile: ${existing.mobile})`);
    return existing;
  }

  const admin = await Admin.create({
    firstName: DEFAULT_ADMIN_FIRST,
    lastName: DEFAULT_ADMIN_LAST,
    mobile: DEFAULT_ADMIN_MOBILE,
    email: DEFAULT_ADMIN_EMAIL,
    role: DEFAULT_ADMIN_ROLE,
    password: DEFAULT_ADMIN_PASSWORD,
  });

  console.log(`Default admin created (mobile: ${admin.mobile}, role: ${admin.role})`);
  return admin;
}

export default ensureDefaultAdmin;

