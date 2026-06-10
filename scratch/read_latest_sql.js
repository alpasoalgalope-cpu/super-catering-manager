const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\fersc\\.gemini\\antigravity\\brain\\142f3749-b491-4a41-9f5b-fcecd94ae176\\.system_generated\\logs\\transcript.jsonl';

async function readLogs() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const matches = [];
  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      const content = step.content || "";
      if (step.source === 'MODEL' && content.toLowerCase().includes('```sql')) {
        matches.push(step);
      }
    } catch (e) {}
  }

  console.log(`Found ${matches.length} matching steps.`);
  matches.forEach(step => {
    console.log(`\n========================================`);
    console.log(`STEP INDEX: ${step.step_index} (${step.created_at}) TYPE: ${step.type}`);
    console.log(`========================================`);
    
    const regex = /```sql([\s\S]*?)```/g;
    let match;
    let index = 1;
    while ((match = regex.exec(step.content)) !== null) {
      console.log(`\n--- SQL BLOCK ${index} ---`);
      console.log(match[1].trim());
      index++;
    }
  });
}

readLogs();
