import dotenv from 'dotenv';

dotenv.config();

const API_URL = `http://localhost:${process.env.PORT || 4000}/api`;

// Must run with AUTH_MODE=mock
if (process.env.AUTH_MODE !== 'mock') {
  console.error('❌ Must run with AUTH_MODE=mock');
  process.exit(1);
}

const otherUserEmails = [
  'priya.patel@sitnagpur.siu.edu.in',
  'arjun.kumar@sitnagpur.siu.edu.in'
];

async function testEndpoint(name, url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    const text = JSON.stringify(data).toLowerCase();
    
    const issues = [];
    
    // Check for hidden_details leak
    if (text.includes('hidden_details')) {
      issues.push('Contains hidden_details');
    }
    
    // Check for email leak (except in /me for own email)
    if (url.includes('/me')) {
      // /me is called with user 1 (rahul.sharma@sitnagpur.siu.edu.in).
      // Check that NO OTHER users' emails are present
      for (const email of otherUserEmails) {
        if (text.includes(email.toLowerCase())) {
          issues.push(`Leaked other user email: ${email}`);
        }
      }
    } else {
      if ((text.match(/@/g) || []).length > 0) {
        issues.push('Contains email addresses');
      }
    }
    
    // Check claim/start response: no expected answers or answers
    if (url.includes('/claim/start')) {
      if (data.expected_answers !== undefined || data.answers !== undefined) {
        issues.push('claim/start leaked expected answers');
      }
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        issues.push('claim/start missing questions array');
      }
    }

    // Check for found item image_url leak (must be has_image instead)
    const itemsToCheck = data.items ? data.items : (data.item ? [data.item] : []);
    for (const item of itemsToCheck) {
      if (item.type === 'found') {
        if (item.image_url !== undefined) {
          issues.push(`Found item (ID ${item.id}) exposed image_url`);
        }
        if (typeof item.has_image !== 'boolean') {
          issues.push(`Found item (ID ${item.id}) missing boolean has_image`);
        }
      }
    }
    
    if (issues.length > 0) {
      console.error(`❌ ${name}: ${issues.join(', ')}`);
      return false;
    } else {
      console.log(`✅ ${name}`);
      return true;
    }
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    return false;
  }
}

async function runLeakTests() {
  console.log('🔍 Running comprehensive leak & hardening tests...\n');
  
  const listingPaths = [
    ['Items feed (all)', `${API_URL}/items`],
    ['Items feed (found only)', `${API_URL}/items?type=found`],
    ['Items feed (lost only)', `${API_URL}/items?type=lost`],
    ['Items feed (status open)', `${API_URL}/items?status=open`],
    ['Items feed (status at_desk)', `${API_URL}/items?status=at_desk`],
    ['Items feed (category electronics)', `${API_URL}/items?category=electronics`],
    ['Items feed (category documents)', `${API_URL}/items?category=documents`],
    ['Items feed (category personal)', `${API_URL}/items?category=personal`],
    ['Items feed (category clothing)', `${API_URL}/items?category=clothing`],
    ['Items feed (location Library)', `${API_URL}/items?location=Library`],
    ['Items feed (location Canteen)', `${API_URL}/items?location=Canteen`],
    ['Items feed (search q=case)', `${API_URL}/items?q=case`],
    ['Items feed (search q=bottle)', `${API_URL}/items?q=bottle`]
  ];

  const singleItemTests = [];
  for (let id = 1; id <= 14; id++) {
    singleItemTests.push([`Single item (ID ${id})`, `${API_URL}/items/${id}`]);
  }

  const otherTests = [
    ['Hotspots', `${API_URL}/stats/hotspots`],
    ['Leaderboard (/api/leaderboard)', `${API_URL}/leaderboard`],
    ['Leaderboard (/api/stats/leaderboard)', `${API_URL}/stats/leaderboard`],
    ['Current user profile (/api/me, no other emails)', `${API_URL}/me`, {
      headers: { 'x-user-id': '1' }
    }],
    ['Claim start on found item (ID 6, no hidden details or answers)', `${API_URL}/items/6/claim/start`, {
      method: 'POST',
      headers: { 'x-user-id': '2', 'Content-Type': 'application/json' }
    }]
  ];

  const tests = [
    ['Health check', `${API_URL}/health`],
    ...listingPaths,
    ...singleItemTests,
    ...otherTests
  ];
  
  const results = [];
  for (const [name, url, options] of tests) {
    const passed = await testEndpoint(name, url, options);
    results.push(passed);
  }
  
  console.log('\n' + '='.repeat(50));
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(`✅ All ${total} leak tests passed!`);
    process.exit(0);
  } else {
    console.log(`❌ ${total - passed} of ${total} tests failed`);
    process.exit(1);
  }
}

runLeakTests();
