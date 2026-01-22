// Toggle a spinner inside a button and disable/enable the button itself.
export const toggleSpinner = (button: HTMLButtonElement, show: boolean): void => {
  const spinner = button.querySelector<HTMLElement>('[data-spinner]');
  if (spinner) {
    spinner.classList.toggle('d-none', !show);
  }
  button.disabled = show;
};
