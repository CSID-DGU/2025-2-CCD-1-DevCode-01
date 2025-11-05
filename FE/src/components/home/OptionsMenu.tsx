import styled from "styled-components";
import { fonts } from "@styles/fonts";
import { forwardRef } from "react";

type Props = {
  onEdit: () => void;
  onDelete: () => void;
};

export const OptionsMenu = forwardRef<HTMLDivElement, Props>(
  function OptionsMenu({ onEdit, onDelete }, ref) {
    return (
      <Dropdown ref={ref} role="menu">
        <DropdownItem role="menuitem" onClick={onEdit}>
          ✏️ 수정
        </DropdownItem>
        <DropdownItem role="menuitem" $danger onClick={onDelete}>
          🗑 삭제
        </DropdownItem>
      </Dropdown>
    );
  }
);

const Dropdown = styled.div`
  position: absolute;
  top: 1.75rem;
  left: 50%;
  transform: translateX(0.5rem);
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
