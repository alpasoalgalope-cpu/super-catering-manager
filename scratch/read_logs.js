const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\fersc\\.gemini\\antigravity\\brain\\142f3749-b491-4a41-9f5b-fcecd94ae176\\.system_generated\\logs\\transcript.jsonl';

async function readLogs() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const steps = [];
  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      steps.push(step);
    } catch (e) {}
  }

  console.log("Searching backwards for model responses...");
  let count = 0;
  // Let's print the last 5 MODEL text responses (excluding tool calls/outputs)
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.source === 'MODEL' && (step.type === 'PLANNER_RESPONSE' || !step.type)) {
      if (step.content && step.content.trim().length > 100) {
        console.log(`\n========================================`);
        console.log(`STEP INDEX: ${step.step_index} (${step.created_at})`);
        console.log(`========================================`);
        console.log(step.content);
        count++;
        if (count >= 3) break;
      }
    }
  }
}

readLogs();
