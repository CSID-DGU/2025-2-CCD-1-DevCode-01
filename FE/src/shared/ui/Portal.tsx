import { useEffect, useRef, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";

export default function Portal({ children }: PropsWithChildren) {
  const elRef = useRef<HTMLDivElement | null>(null);
  if (!elRef.current) {
    elRef.current = document.createElement("div");
    elRef.current.setAttribute("data-portal-root", "true");
  }

  useEffect(() => {
    const el = elRef.current!;
    document.body.appendChild(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  return createPortal(children, elRef.current);
}
