// src/components/home/OptionsMenu.tsx
import styled from "styled-components";
import { fonts } from "@styles/fonts";
import { forwardRef, useEffect, useRef } from "react";

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  onRequestClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
  top?: string;
  left?: string;
  right?: string;
  transform?: string;

  autoFocusFirst?: boolean;
  firstItemRef?: React.Ref<HTMLButtonElement>;
  labelledby?: string;
};

export const OptionsMenu = forwardRef<HTMLDivElement, Props>(
  function OptionsMenu(
    {
      onEdit,
      onDelete,
      onRequestClose,
      className,
      style,
      top,
      left,
      right,
      transform,
      autoFocusFirst = true,
      firstItemRef,
      labelledby,
    },
    ref
  ) {
    const localFirstItemRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
      if (!autoFocusFirst) return;
      const t = setTimeout(() => {
        const el =
          (typeof firstItemRef === "object" &&
            (firstItemRef as React.MutableRefObject<HTMLButtonElement | null>)
              ?.current) ||
          localFirstItemRef.current;
        el?.focus();
      }, 0);
      return () => clearTimeout(t);
    }, [autoFocusFirst, firstItemRef]);

    const stopAll: React.MouseEventHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
      const items = Array.from(
        (e.currentTarget as HTMLDivElement).querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]'
        )
      );
      const idx = items.findIndex((n) => n === document.activeElement);

      if (e.key === "Escape") {
        e.preventDefault();
        onRequestClose?.();
        return;
      }
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(idx + 1) % items.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    };

    return (
      <Dropdown
        ref={ref}
        role="menu"
        aria-labelledby={labelledby}
        className={className}
        style={style}
        $top={top}
        $left={left}
        $right={right}
        $transform={transform}
        onMouseDown={stopAll}
        onClick={stopAll}
        onKeyDown={onKeyDown}
      >
        <DropdownItem
          ref={
            (firstItemRef as React.RefObject<HTMLButtonElement>) ??
            localFirstItemRef
          }
          role="menuitem"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
        >
          ✏️ 수정
        </DropdownItem>
        <DropdownItem
          role="menuitem"
          tabIndex={0}
          $danger
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
        >
          🗑 삭제
        </DropdownItem>
      </Dropdown>
    );
  }
);

const Dropdown = styled.div<{
  $top?: string;
  $left?: string;
  $right?: string;
  $transform?: string;
}>`
  position: absolute;
  top: ${({ $top }) => $top ?? "1.75rem"};
  left: ${({ $left }) => $left ?? "50%"};
  right: ${({ $right }) => $right ?? "auto"};
  transform: ${({ $transform }) => $transform ?? "translateX(0.5rem)"};

  background: white;
  border: 1px solid var(--c-grayL);
  border-radius: 12px;
  padding: 0.5rem;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
  width: 140px;
  z-index: 20;
  display: flex;
  flex-direction: column;
`;

const DropdownItem = styled.button<{ $danger?: boolean }>`
  ${fonts.regular20}
  text-align: left;
  border: 0;
  background: transparent;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  color: ${({ $danger }) => ($danger ? "crimson" : "black")};

  &:hover,
  &:focus-visible {
    background: var(--c-blueL);
    outline: none;
  }
`;
