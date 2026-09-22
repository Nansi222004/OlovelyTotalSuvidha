import http from 'http';
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { userId: '6a7d5b02259ec525f6753dda', userType: 'Admin', role: 'admin' },
  'secret123',
  { expiresIn: '1d' }
);

function get(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1' + path,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('--- Calling GET /admin/inventory/low-stock ---');
  const lowStockRes = await get('/admin/inventory/low-stock?limit=100');
  console.log('Status:', lowStockRes.status);
  console.log('Threshold:', lowStockRes.data?.threshold);
  console.log('Total low stock count:', lowStockRes.data?.data?.length);

  const chilli = lowStockRes.data?.data?.find((p: any) => /chilli/i.test(p.productName));
  console.log('Chilli in low stock?', JSON.stringify(chilli, null, 2));

  console.log('\n--- Calling GET /admin/inventory/transactions ---');
  const txRes = await get('/admin/inventory/transactions?limit=20');
  console.log('Status:', txRes.status);
  console.log('Total transactions count:', txRes.data?.data?.length);
  if (txRes.data?.data?.length > 0) {
    console.log('First 2 transactions:', txRes.data.data.slice(0, 2).map((t: any) => ({
      type: t.type,
      quantity: t.quantity,
      product: t.product?.productName,
      seller: t.seller?.storeName || t.seller?.sellerName || 'No seller'
    })));
  }

  // Check seller 6aaa6d35394a8759641883c2
  console.log('\n--- Checking Seller 6aaa6d35394a8759641883c2 ---');
  const sellerRes = await get('/admin/sellers/6aaa6d35394a8759641883c2');
  console.log('Seller status:', sellerRes.status);
  console.log('Seller info:', sellerRes.data?.data ? {
    sellerName: sellerRes.data.data.sellerName,
    storeName: sellerRes.data.data.storeName,
    email: sellerRes.data.data.email,
    category: sellerRes.data.data.category,
  } : sellerRes.data);
}

main().catch(console.error);
