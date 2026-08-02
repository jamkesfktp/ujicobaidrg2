const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'backend', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('FROM spending_data')) {
    content = content.replace(/FROM spending_data/g, 'FROM mv_spending_data');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
console.log('Replacement complete.');
