import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import type { Tag } from "@/lib/types";

type IconName = "add" | "more" | "tag" | "chevron" | "refresh" | "shuffle" | "close";

export function Icon({ name }: { name: IconName }) {
  const paths: Record<Exclude<IconName, "more">, string> = {
    add: "M12 5v14M5 12h14",
    tag: "M20 13l-7 7a2 2 0 0 1-3 0l-7-7V4a1 1 0 0 1 1-1h9l7 7a2 2 0 0 1 0 3ZM7.5 7.5h.01",
    chevron: "m6 9 6 6 6-6",
    refresh: "M20 4v5h-5M20 9a8 8 0 1 0 .1 6",
    shuffle: "M3 6h3c4 0 5 12 10 12h5m-4-4 4 4-4 4M3 18h3c1.4 0 2.5-1.5 3.6-3.6M14 8c.6-1.2 1.3-2 2-2h5m-4-4 4 4-4 4",
    close: "m6 6 12 12M18 6 6 18",
  };
  return (
    <svg className="control-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === "more" ? (
        <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="2.8" />
      ) : (
        <path d={paths[name]} />
      )}
    </svg>
  );
}

export function Overlay({
  label,
  button,
  className,
  disabled,
  children,
}: {
  label: string;
  button: ReactNode;
  className: string;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const anchor = trigger.current;
    const popover = panel.current;
    if (!open || !anchor || !popover) return;

    function position() {
      if (!anchor || !popover) return;
      const rect = anchor.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const margin = 12;
      if (rect.bottom < 0 || rect.top > height) {
        popover.hidePopover();
        return;
      }
      const below = height - rect.bottom - 8;
      const above = rect.top - 8;
      const opensUp = popover.offsetHeight > below - margin && above > below;
      popover.style.left = `${Math.max(margin, Math.min(rect.left, width - popover.offsetWidth - margin))}px`;
      popover.style.top = opensUp ? "auto" : `${rect.bottom + 8}px`;
      popover.style.bottom = opensUp ? `${height - rect.top + 8}px` : "auto";
      popover.style.maxHeight = `${Math.max(72, (opensUp ? above : below) - margin)}px`;
      popover.dataset.side = opensUp ? "top" : "bottom";
    }

    position();
    const observer = new ResizeObserver(position);
    observer.observe(popover);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={className}
        popoverTarget={id}
        aria-label={label}
        aria-expanded={open}
        disabled={disabled}
        onClick={(event) => {
          const popover = panel.current;
          if (!popover || open) return;
          const { left, bottom } = event.currentTarget.getBoundingClientRect();
          popover.style.left = `${left}px`;
          popover.style.top = `${bottom + 8}px`;
          popover.style.bottom = "auto";
          popover.style.maxHeight = "";
        }}
      >
        {button}
      </button>
      <div
        id={id}
        ref={panel}
        className="overlay-panel"
        popover="auto"
        role="group"
        aria-label={label}
        onToggle={(event) => setOpen(event.currentTarget.matches(":popover-open"))}
      >
        {open ? children(() => panel.current?.hidePopover()) : null}
      </div>
    </>
  );
}

export function FilterTag({
  tag,
  selected,
  revealed,
  disabled,
  onToggle,
  onReveal,
  onDelete,
}: {
  tag: Tag;
  selected: boolean;
  revealed: boolean;
  disabled: boolean;
  onToggle: () => void;
  onReveal: () => void;
  onDelete: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);

  function clearHold() {
    clearTimeout(timer.current);
    start.current = null;
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function startHold(event: PointerEvent<HTMLButtonElement>) {
    clearHold();
    held.current = false;
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    start.current = { x: event.clientX, y: event.clientY };
    timer.current = setTimeout(() => {
      held.current = true;
      onReveal();
    }, 480);
  }

  return (
    <div className="filter-tag" data-revealed={revealed || undefined}>
      <button
        type="button"
        className="filter-tag-toggle"
        aria-pressed={selected}
        onClick={(event) => {
          if (held.current && event.detail !== 0) {
            held.current = false;
            return;
          }
          onToggle();
        }}
        onPointerDown={startHold}
        onPointerMove={(event) => {
          const point = start.current;
          if (point && Math.hypot(event.clientX - point.x, event.clientY - point.y) > 9)
            clearHold();
        }}
        onPointerUp={clearHold}
        onPointerCancel={clearHold}
        onPointerLeave={clearHold}
        onContextMenu={(event) => {
          if (start.current || held.current) event.preventDefault();
        }}
      >
        <span className="filter-mark" aria-hidden="true">{selected ? "✓" : ""}</span>
        <span>{tag.name}</span>
      </button>
      <button
        type="button"
        className="tag-remove"
        aria-label={"Delete tag " + tag.name}
        title={"Delete " + tag.name}
        disabled={disabled}
        onClick={onDelete}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
