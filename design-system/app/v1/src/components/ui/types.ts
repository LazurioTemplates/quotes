// Types shared by the reference components (an .astro file cannot export
// them to other components reliably).
export type IconName =
  | "flask"
  | "check"
  | "shield"
  | "fork"
  | "send"
  | "draft"
  | "link"
  | "alert"
  | "error"
  | "plus"
  | "search"
  | "close"
  | "grid"
  | "list"
  | "book"
  | "theme";

// The statuses of the method, content/components/badge.md.
export type Status =
  | "hypothesis"
  | "running"
  | "verified"
  | "stopped"
  | "scaling"
  | "draft"
  | "new";
