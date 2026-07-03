const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  /const data = newAnalysesEntries\[email\.id\];\n*const data = newAnalysesEntries\[email\.id\];/g,
  "const data = newAnalysesEntries[email.id];"
);
// In case it's on the exact same line but without newline:
code = code.replace(
  /const data = newAnalysesEntries\[email\.id\];const data = newAnalysesEntries\[email\.id\];/g,
  "const data = newAnalysesEntries[email.id];"
);
fs.writeFileSync('src/App.tsx', code);
