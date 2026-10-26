import { execFile } from 'node:child_process';

/** Terminal bell + best-effort desktop notification. Arguments are passed as argv, never via a shell. */
export function notify(title, message) {
  process.stdout.write('\x07');
  const done = () => {};
  try {
    if (process.platform === 'darwin') {
      execFile('osascript', ['-e', `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`], done);
    } else if (process.platform === 'linux') {
      execFile('notify-send', [title, message], done);
    } else if (process.platform === 'win32') {
      execFile('msg', ['*', `${title}: ${message}`], done);
    }
  } catch {
    /* notifications are a nicety */
  }
}
