const { spawn } = require('child_process');
const axios = require('axios');

async function testSetup() {
  console.log('🚀 Testing Jotihunt setup...');
  
  // Start backend
  console.log('📡 Starting backend server...');
  const backend = spawn('npm', ['run', 'dev'], {
    cwd: './backend',
    stdio: 'pipe'
  });

  // Wait for backend to start
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:3001/api/health');
    console.log('✅ Backend health check:', healthResponse.data);

    // Test login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ Admin login successful');

    // Test areas endpoint
    const areasResponse = await axios.get('http://localhost:3001/api/jotihunt/areas', {
      headers: { Authorization: `Bearer ${loginResponse.data.token}` }
    });
    console.log('✅ Areas loaded:', areasResponse.data.length, 'areas');

    console.log('🎉 All tests passed! Setup is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    backend.kill();
  }
}

if (require.main === module) {
  testSetup();
}