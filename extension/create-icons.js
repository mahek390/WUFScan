const fs = require('fs');

// Create simple PNG icons using data URLs
const sizes = [16, 48, 128];

sizes.forEach(size => {
  // Create a simple red circle with white text as base64 PNG
  const canvas = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#0a0a0a"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size*0.35}" fill="#c41e3a"/>
    <text x="${size/2}" y="${size*0.65}" font-size="${size*0.4}" text-anchor="middle" fill="#e8dcc4">🕵</text>
  </svg>`;
  
  fs.writeFileSync(`icon${size}.svg`, canvas);
  console.log(`Created icon${size}.svg`);
});
