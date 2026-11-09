import { access, readFile, writeFile } from 'node:fs/promises';

// Capacitor uses Windows separators when generating Swift package paths on Windows.
// Keep the generated iOS project usable when it is opened on a Mac.
if (process.env.CAPACITOR_PLATFORM_NAME === 'ios') {
  const packageUrl = new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url);
  const source = await readFile(packageUrl, 'utf8');
  const portable = source.replace(/(path: ")([^"]+)(")/g, (_, start, path, end) =>
    `${start}${path.replaceAll('\\', '/')}${end}`);
  for (const [, path] of portable.matchAll(/path: "([^"]+)"/g)) {
    await access(new URL(`${path}/Package.swift`, packageUrl));
  }
  if (portable !== source) await writeFile(packageUrl, portable);
}
