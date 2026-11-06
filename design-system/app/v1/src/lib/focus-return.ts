// Where focus goes when the element holding it leaves the page (a toast that is
// closed or pushed out): back to where it came from if that can still take
// focus, otherwise to the page's main region. Never nowhere.
export type FocusOrigin = { connected: boolean; inClosedDialog: boolean; disabled: boolean };

export function focusReturn(origin: FocusOrigin | null): "origin" | "main" {
  return origin?.connected && !origin.inClosedDialog && !origin.disabled ? "origin" : "main";
}
