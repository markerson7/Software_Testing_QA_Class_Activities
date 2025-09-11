import express from 'express';
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Testing Environment ready',
    moduleType: 'ES modules',
    moduleVersion: process.version
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
});
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;