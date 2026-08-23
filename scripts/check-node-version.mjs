const [major, minor] = process.versions.node.split('.').map(Number);
const supported = major > 22 || (major === 22 && minor >= 13);

if (!supported) {
  console.error(
    `Money Tracker потребує Node.js >=22.13. Поточна версія: ${process.version}. Виконайте: nvm use`,
  );
  process.exit(1);
}
