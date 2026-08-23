export interface ErrorLocation {
  column?: number;
  file: string;
  function?: string;
  line?: number;
}

export interface ErrorDetails {
  application_location?: ErrorLocation;
  location?: ErrorLocation;
  message: string;
  name: string;
  stack?: string;
}

const STACK_FRAME_PATTERN = /^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/;

export function errorDetails(error: unknown): ErrorDetails {
  if (!(error instanceof Error)) {
    return { name: 'UnknownError', message: String(error) };
  }

  const frames = stackFrames(error.stack);
  const applicationLocation = frames.find((frame) => isApplicationFrame(frame.file));
  return {
    name: error.name,
    message: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
    ...(frames[0] ? { location: frames[0] } : {}),
    ...(applicationLocation ? { application_location: applicationLocation } : {}),
  };
}

function stackFrames(stack?: string): ErrorLocation[] {
  if (!stack) return [];
  const frames: ErrorLocation[] = [];
  for (const line of stack.split('\n').slice(1)) {
    const match = STACK_FRAME_PATTERN.exec(line);
    if (!match?.[2]) continue;
    frames.push({
      ...(match[1] ? { function: match[1].replace(/^async\s+/, '') } : {}),
      file: match[2],
      line: Number(match[3]),
      column: Number(match[4]),
    });
  }
  return frames;
}

function isApplicationFrame(file: string): boolean {
  return /\/apps\/api\/(?:src|dist)\//.test(file) && !file.includes('/node_modules/');
}
