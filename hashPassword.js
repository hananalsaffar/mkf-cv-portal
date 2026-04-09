// Temporary script to generate a hashed password for the company test account.
const bcrypt = require("bcrypt");

(async () => {
  const hashedPassword = await bcrypt.hash("CompanyTest123!", 10);
  console.log(hashedPassword);
})();