async function main() {
  const url = 'https://raw.githubusercontent.com/manojbillionaire/New-Drafter/main/src/components/AdvocatePortal.tsx';
  console.log('Fetching', url);
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    if (line.includes('systemDirectives') && line.includes('const ')) {
      console.log(`systemDirectives definition starts at line ${i+1}:`);
      console.log(lines.slice(i, i + 35).join('\n'));
    }
  });
}

main().catch(console.error);
