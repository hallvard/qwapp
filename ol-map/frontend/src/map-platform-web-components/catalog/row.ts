export type RowVariant = "group" | "layer";

export type RowUpdate = {
  title: string;
  checked: boolean;
  indeterminate: boolean;
  toggleLabel: string;
  depth: number;
  /**
   * Applied only the first time a row appears — later calls omit it, so a
   * `<details>` a reader opened or closed themselves is never folded back to
   * its default just because a sibling's visibility changed elsewhere.
   */
  defaultOpen?: boolean;
  onToggle: (checked: boolean) => void;
};

export type OpacityUpdate = {
  value: number;
  label: string;
  onChange: (value: number) => void;
};

/**
 * Strips Designsystemet's card framing off `ds-details` for a dense list.
 * Leaves `--dsc-details-icon-size`/`--dsc-details-icon-url` alone — the
 * expand chevron is a `::before` masked with the latter, sized by the
 * former, and neither needs overriding just to remove the card look.
 */
const QUIET_DETAILS_STYLE: Record<string, string> = {
  "--dsc-details-padding": "0",
  "--dsc-details-size": "0",
  "--dsc-details-summary-background": "none",
  "--dsc-details-summary-background--open": "none",
  "--dsc-details-summary-background--hover": "none",
  border: "none",
  background: "none",
};

/**
 * One row's DOM, built once and patched in place on every update. A naive
 * full rebuild on every state change would drop the `<details>` open/closed
 * state a reader chose, and mid-drag would steal focus from the very opacity
 * slider driving the update in the first place — the same reason
 * `DatasetLayerController` patches an OL layer in place instead of rebuilding
 * it, applied here to plain DOM.
 */
export class RowController {
  readonly element: HTMLDivElement;
  readonly content: HTMLDivElement;
  readonly childRows = new Map<string, RowController>();

  readonly #checkbox: HTMLInputElement;
  readonly #details: HTMLDetailsElement;
  readonly #titleEl: HTMLElement;
  #opacityInput: HTMLInputElement | null = null;
  #onToggle: ((checked: boolean) => void) | undefined;
  #onOpacityChange: ((value: number) => void) | undefined;

  constructor(variant: RowVariant) {
    this.element = document.createElement("div");
    this.element.className = "mp-catalog-row";
    this.element.dataset.variant = variant;

    const header = document.createElement("div");
    header.className = "mp-catalog-row-header";

    this.#checkbox = document.createElement("input");
    this.#checkbox.type = "checkbox";
    // Designsystemet styles `input[type=checkbox]` off `.ds-input`, the same
    // class `Input` applies under its `Checkbox` — there is no `.ds-checkbox`.
    this.#checkbox.className = "ds-input";
    this.#checkbox.addEventListener("change", () => this.#onToggle?.(this.#checkbox.checked));

    this.#details = document.createElement("details");
    this.#details.className = "ds-details mp-catalog-details";
    for (const [property, value] of Object.entries(QUIET_DETAILS_STYLE)) {
      this.#details.style.setProperty(property, value);
    }

    const summary = document.createElement("summary");
    this.#titleEl = document.createElement(variant === "group" ? "strong" : "span");
    summary.append(this.#titleEl);

    this.content = document.createElement("div");
    this.content.className = "mp-catalog-content";

    this.#details.append(summary, this.content);
    header.append(this.#checkbox, this.#details);
    this.element.append(header);
  }

  update(params: RowUpdate): void {
    this.#checkbox.checked = params.checked;
    this.#checkbox.indeterminate = params.indeterminate;
    if (params.indeterminate) this.#checkbox.dataset.indeterminate = "";
    else delete this.#checkbox.dataset.indeterminate;
    this.#checkbox.setAttribute("aria-label", params.toggleLabel);
    this.#titleEl.textContent = params.title;
    this.element.style.setProperty("--mp-catalog-depth", String(params.depth));
    this.#onToggle = params.onToggle;
    if (params.defaultOpen !== undefined) this.#details.open = params.defaultOpen;
  }

  setOpacityControl(params: OpacityUpdate): void {
    if (this.#opacityInput === null) {
      const input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = "1";
      input.step = "0.05";
      input.className = "ds-focus mp-catalog-opacity";
      input.addEventListener("input", () => this.#onOpacityChange?.(input.valueAsNumber));
      this.content.prepend(input);
      this.#opacityInput = input;
    }
    const input = this.#opacityInput;
    // Never overwrite the value of the slider the reader has their hand on.
    if (document.activeElement !== input) input.value = String(params.value);
    input.setAttribute("aria-label", params.label);
    input.setAttribute("aria-valuetext", `${Math.round(params.value * 100)}%`);
    this.#onOpacityChange = params.onChange;
  }
}
