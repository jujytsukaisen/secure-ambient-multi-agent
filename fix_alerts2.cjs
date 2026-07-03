const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const data = batchData\[email\.id\] \|\| \{[\s\S]*?تحليل محلي احتياطي"\n\s*\};\n\s*const data = newAnalysesEntries\[email\.id\];/,
  `const data = newAnalysesEntries[email.id];`
);

fs.writeFileSync('src/App.tsx', code);
