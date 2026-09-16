const app = require('./app');
const { connectWithRetry } = require('./db');

const PORT = process.env.PORT || 3000;

connectWithRetry().then(() => {
  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
});
