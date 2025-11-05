// src/components/home/OptionsMenu.tsx
import styled from "styled-components";
import { fonts } from "@styles/fonts";
import { forwardRef } from "react";

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** 배치 커스텀 (필요한 것만 넘겨도 됨) */
  top?: string;
  left?: string;
  right?: string;
  transform?: string;
};

export const OptionsMenu = forwardRef<HTMLDivElement, Props>(
  function OptionsMenu(
    { onEdit, onDelete, className, style, top, left, right, transform },
    ref
  ) {
    const stopAll: React.MouseEventHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    return (
      <Dropdown
        ref={ref}
        role="menu"
        className={className}
        style={style}
        $top={top}
        $left={left}
        $right={right}
        $transform={transform}
        onMouseDown={stopAll}
        onClick={stopAll}
      >
        <DropdownItem
          role="menuitem"
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
  /* 기본값(이전 동작 유지) */
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
  color: black;
  &:hover {
    background: var(--c-blueL);
  }
`;
