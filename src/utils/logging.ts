// Append a log line and keep the scroll position at the bottom.
export const appendLog = (element: HTMLElement, message: string): void => {
  element.textContent = `${element.textContent ?? ''}${message}`;
  element.scrollTop = element.scrollHeight;
};
