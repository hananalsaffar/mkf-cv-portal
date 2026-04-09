require("dotenv").config();

// Import Express app configuration
const app = require("./app");

// Use Render's port or fallback to local
const PORT = process.env.PORT || 5001;

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});