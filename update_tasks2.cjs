const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /color: data\.classification === "important" \? "bg-rose-500" : data\.classification === "meeting_request" \? "bg-cyan-500" : "bg-green-500",\n\s*opacity: ""\n\s*\}, \.\.\.prev\];/g,
  'color: data.classification === "important" ? "bg-rose-500" : data.classification === "meeting_request" ? "bg-cyan-500" : "bg-green-500",\n                opacity: "",\n                startTime: (data as any).meetingStartTime,\n                endTime: (data as any).meetingEndTime\n              }, ...prev];'
);

// also fix the manual task one
code = code.replace(
  /color: data\.classification === "important" \? "bg-rose-500" : "bg-cyan-500",\n\s*opacity: ""\n\s*\}, \.\.\.prev\]\);/g,
  'color: data.classification === "important" ? "bg-rose-500" : "bg-cyan-500",\n            opacity: "",\n            startTime: (data as any).meetingStartTime,\n            endTime: (data as any).meetingEndTime\n          }, ...prev]);'
);

fs.writeFileSync('src/App.tsx', code);
