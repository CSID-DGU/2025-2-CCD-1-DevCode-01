import { Outlet, useMatches, useParams, useLocation } from "react-router-dom";
import styled from "styled-components";
import Nav from "@widgets/Nav/Nav";
import type { NavMeta } from "@widgets/Nav/types";

const DefaultLayout = () => {
  const matches = useMatches();
  const params = useParams<Record<string, string>>();
  const { state } = useLocation() as { state?: { subject?: string } };

  const last = matches[matches.length - 1];
  const navMeta = (last?.handle as { nav?: NavMeta })?.nav;

  const baseVariant = navMeta?.variant ?? "folder";
  const variant = baseVariant;

  const computedTitle =
    baseVariant === "exam" && state?.subject
      ? `${state.subject} 시험`
      : typeof navMeta?.title === "function"
      ? navMeta.title(params)
      : navMeta?.title;

  return (
    <Wrapper>
      <Nav variant={variant} title={computedTitle} />
      <Container>
        <Outlet />
      </Container>
    </Wrapper>
  );
};

export default DefaultLayout;

const Wrapper = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
`;

const Container = styled.section`
  flex: 1;
  display: flex;
`;
