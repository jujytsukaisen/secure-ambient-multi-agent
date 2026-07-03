const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /for \(const email of unscannedEmails\) \{\n\s*setEmailAnalyses\(prev => \(\{ \.\.\.prev, \[email\.id\]: data \}\)\);/g,
  `for (const email of unscannedEmails) {
          const data = batchData[email.id] || {
            classification: "low_priority",
            priority: "LOW",
            isPromptInjection: false,
            action: "تصنيف تلقائي",
            details: "تحليل محلي احتياطي"
          };
          setEmailAnalyses(prev => ({ ...prev, [email.id]: data }));`
);

fs.writeFileSync('src/App.tsx', code);
