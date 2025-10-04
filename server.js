// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json({ limit: '50mb' }));

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Upload endpoint
app.post('/upload', (req, res) => {
  const { photo, index } = req.body;
  if (!photo || !index) return res.status(400).json({ error: 'Missing data' });

  const base64Data = photo.replace(/^data:image\/png;base64,/, '');
  const filename = `photo_${index}.png`;
  const filepath = path.join(__dirname, 'uploads', filename);

  fs.writeFileSync(filepath, base64Data, 'base64');
  res.json({ success: true });
});

// Gallery endpoint
app.get('/photos', (req, res) => {
  const files = fs.readdirSync('uploads')
    .filter(f => f.endsWith('.png'))
    .map(f => {
      const stats = fs.statSync(path.join('uploads', f));
      return {
        url: `/uploads/${f}`,
        name: f,
        timestamp: stats.mtime.toLocaleString()
      };
    });
  res.json(files);
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
