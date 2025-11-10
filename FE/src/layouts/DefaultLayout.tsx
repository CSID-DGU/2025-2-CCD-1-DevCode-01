import { Outlet, useMatches, useParams, useLocation } from "react-router-dom";
import styled from "styled-components";
import Nav from "@widgets/Nav/Nav";
import type { NavMeta } from "@widgets/Nav/types";

type NavState = { navTitle?: string; subject?: string };

const DefaultLayout = () => {
  const matches = useMatches();
  const params = useParams<Record<string, string>>();
  const { state } = useLocation() as { state?: NavState };

  const last = matches[matches.length - 1];
  const navMeta = (last?.handle as { nav?: NavMeta })?.nav;

  const baseVariant = navMeta?.variant ?? "folder";
  const variant = baseVariant;

  const computedTitle =
    // 1순위: 페이지 전환 시 넘겨준 제목
    state?.navTitle ??
    // 2순위: exam 특수 케이스 유지
    (baseVariant === "exam" && state?.subject
      ? `${state.subject} 시험`
      : // 3순위: 함수형 title
      typeof navMeta?.title === "function"
      ? navMeta.title(params)
      : // 4순위: 정적 title
        navMeta?.title);

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
