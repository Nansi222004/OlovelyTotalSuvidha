require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Find delivery boys
  const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));
  const boys = await DeliveryBoy.find({}).limit(5).lean();
  console.log('Found delivery boys:', boys.length);
  boys.forEach(b => console.log(' -', b._id, b.name, 'status:', b.status));

  if (boys.length > 0) {
    const d = boys[0];
    const token = jwt.sign({ userId: d._id.toString(), userType: 'Delivery' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    console.log('\nDelivery token for', d._id, ':', token);
  }
  mongoose.disconnect();
}).catch(e => console.error(e.message));
