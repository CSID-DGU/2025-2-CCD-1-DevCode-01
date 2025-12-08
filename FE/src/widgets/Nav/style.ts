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

  &:focus-visible {
    outline: 5px solid var(--c-white);
    outline-offset: 2px;
  }
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

  &:focus-visible {
    outline: 5px solid var(--c-white);
    outline-offset: 2px;
  }
`;

export const TabLink = styled(NavLink)`
  ${fonts.medium24}
  text-decoration: none;
  color: var(--c-white);
  border-radius: 6px;
`;
