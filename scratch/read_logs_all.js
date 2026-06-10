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
      if (step.step_index < 500 && (content.toLowerCase().includes('```sql') || content.toUpperCase().includes('DROP POLICY'))) {
        matches.push(step);
      }
    } catch (e) {}
  }

  console.log(`Found ${matches.length} matches prior to step 500.`);
  matches.forEach(step => {
    console.log(`\n========================================`);
    console.log(`STEP INDEX: ${step.step_index} (${step.created_at}) SOURCE: ${step.source} TYPE: ${step.type}`);
    console.log(`========================================`);
    console.log(step.content);
  });
}

readLogs();
