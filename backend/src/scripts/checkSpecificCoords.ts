import dotenv from 'dotenv';
dotenv.config();

async function testWithToken() {
  const mongoose = await import('mongoose');
  const Customer = (await import('../models/Customer')).default;
  const { generateToken } = await import('../services/jwtService');
  const axios = (await import('axios')).default;

  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected to DB');

  // Find a customer
  const customer = await Customer.findOne().lean();
  if (!customer) {
    console.error('No customer found in database');
    await mongoose.disconnect();
    return;
  }

  // Generate token
  const token = generateToken(
    customer._id.toString(),
    'Customer'
  );

  console.log('Generated token:', token);
  await mongoose.disconnect();

  try {
    const res = await axios.get('http://localhost:5000/api/v1/customer/home?latitude=23.9185649&longitude=76.9113222', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('API SUCCESS:', res.data.success);
    const homeSections = res.data.data.homeSections;
    console.log('Number of home sections:', homeSections.length);
    for (const section of homeSections) {
      console.log(`- Section: ${section.title} (${section.displayType}), data length: ${section.data?.length}`);
      if (section.title === 'test') {
        console.log('Test section data:', JSON.stringify(section.data, null, 2));
      }
    }
  } catch (err: any) {
    console.error('API ERROR:', err.response?.data || err.message);
  }
}

testWithToken();
