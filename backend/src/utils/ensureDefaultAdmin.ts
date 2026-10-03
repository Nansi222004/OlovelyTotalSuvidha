import Admin from '../models/Admin';

/**
 * Optionally create the initial admin from environment configuration.
 * No fallback credentials are kept in source code.
 */
export async function ensureDefaultAdmin() {
  const mobile = process.env.DEFAULT_ADMIN_MOBILE?.trim() || '';
  const email = process.env.DEFAULT_ADMIN_EMAIL?.trim().toLowerCase() || '';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || '';
  const firstName = process.env.DEFAULT_ADMIN_FIRST?.trim() || 'Default';
  const lastName = process.env.DEFAULT_ADMIN_LAST?.trim() || 'Admin';
  const role = process.env.DEFAULT_ADMIN_ROLE === 'Admin' ? 'Admin' : 'Super Admin';

  if (!mobile || !email || !password) {
    console.log('ℹ️ [Admin Seeding] Initial admin creation skipped; DEFAULT_ADMIN_MOBILE, DEFAULT_ADMIN_EMAIL, and DEFAULT_ADMIN_PASSWORD must all be configured');
    return null;
  }

  const existing = await Admin.findOne({
    $or: [{ mobile }, { email }],
  });

  if (existing) {
    console.log('ℹ️ [Admin Seeding] Configured initial admin already exists');
    return existing;
  }

  const admin = await Admin.create({
    firstName,
    lastName,
    mobile,
    email,
    role,
    password,
  });

  console.log(`✓ [Admin Seeding] Initial admin created with role ${admin.role}`);
  return admin;
}

export default ensureDefaultAdmin;

