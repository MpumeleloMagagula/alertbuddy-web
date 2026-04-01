const fs = require('fs');
const dotenv = require('dotenv');
const parsed = dotenv.parse(fs.readFileSync('C:/Users/Mpumelelo.Magagula/Documents/Projects/alert-buddy-web/backend/.env'));
console.log("From dotenv:");
console.log(parsed.FIREBASE_SERVICE_ACCOUNT_KEY.substring(0, 50));
try {
  const sa = JSON.parse(parsed.FIREBASE_SERVICE_ACCOUNT_KEY);
  console.log("Parsed JSON key first 50 chars:");
  console.log(sa.private_key.substring(0, 50));
  console.log("Does it contain actual newlines?", sa.private_key.includes('\n'));
} catch (e) {
  console.error(e);
}
