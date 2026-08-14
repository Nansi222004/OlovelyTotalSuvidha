import axios from 'axios';

async function testApi() {
  try {
    const res = await axios.get('http://localhost:5000/api/v1/customer/home?latitude=23.9164&longitude=76.9180');
    console.log('API SUCCESS:', res.data.success);
    console.log('Sections returned:', res.data.data.homeSections.map((s: any) => ({
      title: s.title,
      displayType: s.displayType,
      dataLength: s.data?.length,
      data: s.data
    })));
  } catch (err: any) {
    console.error('API ERROR:', err.message);
  }
}

testApi();
