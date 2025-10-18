import { Outlet } from "react-router-dom";

import styled from "styled-components";
import Nav from "./components/Nav";

const DefaultLayout = () => {
  return (
    <OutletWrapper>
      <Nav />
      <Outlet />
    </OutletWrapper>
  );
};

export default DefaultLayout;

const OutletWrapper = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: auto;
`;
