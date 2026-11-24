const { getAccessToken } = require('../out/auth');
const { fetchUsage } = require('../out/api');

async function main() {
  const token = getAccessToken();
  if (!token) {
    console.error('No access token');
    process.exit(1);
  }

  const data = await fetchUsage(token);
  console.log('onDemand:', JSON.stringify(data.onDemand, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
