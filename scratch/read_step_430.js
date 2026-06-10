const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\fersc\\.gemini\\antigravity\\brain\\142f3749-b491-4a41-9f5b-fcecd94ae176\\.system_generated\\logs\\transcript.jsonl';

async function readLogs() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      if (step.step_index === 430) {
        console.log("=========================================");
        console.log("CONTENT OF STEP 430:");
        console.log("=========================================");
        console.log(step.content);
        break;
      }
    } catch (e) {}
  }
}

readLogs();
