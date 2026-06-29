import axios from 'axios';
async function run() {
  try {
    const API_KEY = 'ea323792994b2f107fead1db';
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`, {
      timeout: 5000
    });
    console.log(response.data.conversion_rates.KES);
  } catch (err) {
    console.error(err.message);
  }
}
run();
