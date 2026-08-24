require('dotenv').config();
const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  customer: mongoose.Schema.Types.ObjectId,
  type: String,
  fullName: String,
  phone: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  landmark: String,
  latitude: Number,
  longitude: Number,
  isDefault: Boolean,
}, { timestamps: true });

const Address = mongoose.model('Address', AddressSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Find all addresses with "Current Location," prefix
  const staleAddresses = await Address.find({
    address: { $regex: /^Current Location/i }
  }).lean();
  
  console.log('Found stale addresses:', staleAddresses.length);
  staleAddresses.forEach(a => console.log(' -', a._id, ':', a.address.substring(0, 80)));

  // Fix them by stripping the "Current Location, " prefix
  for (const addr of staleAddresses) {
    const fixedAddress = addr.address.replace(/^Current Location,?\s*/i, '').trim();
    await Address.findByIdAndUpdate(addr._id, { address: fixedAddress });
    console.log('Fixed:', addr._id, '->', fixedAddress.substring(0, 80));
  }

  // Also update the specific test customer's addresses to the named place
  const customerId = '6a7e05ddd9341125c8a8dea9';
  const updateResult = await Address.updateMany(
    { customer: new mongoose.Types.ObjectId(customerId) },
    { $set: {
      address: 'Corporate House, 208, 169, RNT Marg, near CENTRAL, RNT Marg, Indore, Madhya Pradesh 452001',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001'
    }}
  );
  console.log('Updated test customer addresses:', JSON.stringify(updateResult));

  // Verify
  const updated = await Address.find({ customer: new mongoose.Types.ObjectId(customerId) }, 'address city state pincode').lean();
  console.log('Verified updated addresses:', JSON.stringify(updated, null, 2));

  await mongoose.disconnect();
  console.log('Done');
}

run().catch(e => { console.error(e); process.exit(1); });
