let interactiveMode = false;

export class CommandFailure extends Error {
  code: number;
  reported: boolean;

  constructor(message: string, code: number, reported = false) {
    super(message);
    this.name = "CommandFailure";
    this.code = code;
    this.reported = reported;
  }
}

export function setInteractiveMode(enabled: boolean): void {
  interactiveMode = enabled;
}

export function isInteractiveMode(): boolean {
  return interactiveMode;
}
