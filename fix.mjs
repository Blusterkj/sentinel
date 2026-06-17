import fs from 'fs';

const filePath = 'c:/Users/blust/sentinel/proxy.mjs';
let content = fs.readFileSync(filePath, 'utf8');

const target = `    res.json({ response: result.text });`;
const replacement = `    res.json({ response: resultText });`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content);
  console.log('Success');
} else {
  console.log('Target not found');
}
