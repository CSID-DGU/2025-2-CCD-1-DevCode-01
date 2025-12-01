import styled from "styled-components";
import { fonts } from "@styles/fonts";
import { Link, NavLink } from "react-router-dom";

export const NavWrapper = styled.nav`
  padding: 6px 35px 6px 24px;
  background: var(--c-blue);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--c-blue);
  color: var(--c-white);
  position: sticky;
  top: 0;
  z-index: 999;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
`;

export const BrandArea = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  ${fonts.medium24}

  img {
    width: 60px;
  }
`;

export const BrandText = styled.span`
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.2px;
`;

export const Title = styled.div`
  justify-self: center;
  ${fonts.medium24}
  text-align: center;
`;

export const Left = styled.div`
  justify-self: start;
  display: inline-flex;
  align-items: center;
`;

export const Right = styled.div`
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 12px;
`;

export const IconButton = styled.button`
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  cursor: pointer;

  img {
    width: 24px;
  }
`;

export const IconLink = styled(Link)`
  text-decoration: none;
  color: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
`;

export const Actions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 14px;
`;

export const LeftActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 16px;
`;

export const ActionButton = styled.button`
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  cursor: pointer;

  img {
    width: 24px;
    color: var(--c-white);
  }
  em {
    color: var(--c-white);
    ${fonts.regular17}
  }
`;

export const RecordingBadge = styled.span`
  font-size: 12px;
  font-weight: 700;
`;

export const FolderLeft = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 12px;

  img {
    width: 50px;
    height: 50px;
  }
`;

export const TabNav = styled.nav`
  display: inline-flex;
  align-items: center;
  gap: 16px;
`;

export const TabLink = styled(NavLink)`
  ${fonts.medium24}
  text-decoration: none;
  color: var(--c-white);
  border-radius: 6px;
`;

export const RecPill = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
  margin-left: 8px;

  img {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .rec-time {
    font-size: 13px;
    font-weight: 700;
    color: #111; /* 진하게 */
    text-shadow: 0 0 1px rgba(255, 255, 255, 0.6);
    min-width: 44px;
    text-align: right;
  }
`;

/** 공통 아이콘 버튼 */
export const RecIconBtn = styled.button`
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  width: 22px;
  height: 22px;
  border-radius: 4px; /* 살짝 둥근 모서리(정지 버튼 모양과 동일 톤) */
  cursor: pointer;
  display: inline-grid;
  place-items: center;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
  &:active {
    filter: brightness(0.9);
  }
  &:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
`;

/** 일시정지(Ⅱ) 아이콘 */
export const PauseGlyph = styled.span`
  position: relative;
  width: 12px;
  height: 14px;
  &::before,
  &::after {
    content: "";
    position: absolute;
    top: 0;
    width: 4px;
    height: 14px;
    border-radius: 1px;
    background: #5f6368; /* 구글 스타일의 회색 톤 */
  }
  &::before {
    left: 0;
  }
  &::after {
    right: 0;
  }
`;

/** 정지(■) 아이콘 */
export const StopGlyph = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: #5f6368;
`;

/** 알약 왼쪽 빨간점 대신 공백 유지 (디자인상 미사용이면 생략 가능) */
export const RecSpacer = styled.span`
  display: inline-block;
  width: 0;
`;
