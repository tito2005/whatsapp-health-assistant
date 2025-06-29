#!/usr/bin/env node

const http = require('http');

async function testQRCode() {
  console.log('🧪 Testing QR Code Generation');
  console.log('==============================\n');

  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    // Test health endpoint
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await makeRequest('http://localhost:3000/health');
    console.log('✅ Health endpoint:', healthResponse.status || 'unknown');
    
    // Test QR endpoint
    console.log('\n2️⃣ Testing QR code endpoint...');
    const qrResponse = await makeRequest('http://localhost:3000/api/whatsapp/qr');
    
    if (qrResponse.success !== undefined) {
      if (qrResponse.success && qrResponse.data?.qrCode) {
        console.log('✅ QR code generated successfully!');
        console.log('🌐 QR code available at: http://localhost:3000/api/whatsapp/qr/display');
      } else if (!qrResponse.data?.qrCode) {
        console.log('⏳ QR code not ready yet - this is normal during initial connection');
        console.log('💡 Try again in a few seconds or check the main application logs');
      }
    } else {
      console.log('⚠️  Unexpected response format:', JSON.stringify(qrResponse, null, 2));
    }

    console.log('\n🎉 QR Code test completed!');
    console.log('📱 To connect WhatsApp:');
    console.log('   1. Open http://localhost:3000/api/whatsapp/qr/display in browser');
    console.log('   2. Scan QR code with WhatsApp mobile app');
    console.log('   3. Go to WhatsApp > Settings > Linked Devices > Link a Device');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: data, status: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

if (require.main === module) {
  testQRCode();
}